import type { SapphireClient } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';
import type { AuctionLotRow, AuctionRow, BidRow } from '../types/database';
import { AuctionLotWithBidComponents, BidLogComponents, OutbidDMComponents } from './messageComponentUtil';

interface PlaceAuctionBidInput {
  client: SapphireClient;
  userId: string;
  guildId: string;
  lot: AuctionLotRow;
  auction: AuctionRow;
  amount: number;
}

type PlaceAuctionBidResult = { status: 'placed'; bid: BidRow; topBid: BidRow } | { status: 'outbid'; currentTopBid?: BidRow };

interface RevertAuctionBidInput {
  client: SapphireClient;
  bidId: number;
  revertedBy: string;
  reason: string;
}

type RevertAuctionBidResult =
  | { status: 'reverted'; bid: BidRow; lot: AuctionLotRow }
  | { status: 'already-reverted' }
  | { status: 'missing-bid' }
  | { status: 'missing-lot' }
  | { status: 'auction-ended' };

async function refreshAuctionLotMessage(client: SapphireClient, lot: AuctionLotRow, topBid?: BidRow) {
  if (!lot.message_id || !lot.channel_id) return;

  try {
    const channel = client.channels.cache.get(lot.channel_id) ?? (await client.channels.fetch(lot.channel_id));
    if (channel?.isTextBased()) {
      const message = await channel.messages.fetch(lot.message_id);
      await message.edit({
        components: [AuctionLotWithBidComponents({ lot, lotNumber: lot.lot_number!, topBid })],
        flags: [MessageFlags.IsComponentsV2],
      });
    }
  } catch (err) {
    client.logger.error(`auctionBidFlow: failed to edit lot message for lot ${lot.id}:`, err);
  }
}

async function sendOutbidDm({
  client,
  previousTopBid,
  lot,
  auction,
  newAmount,
  guildId,
}: {
  client: SapphireClient;
  previousTopBid?: BidRow;
  lot: AuctionLotRow;
  auction: AuctionRow;
  newAmount: number;
  guildId: string;
}) {
  if (!previousTopBid?.user_id) return;

  if (!Database.getOutbidSubscription(lot.auction_id, previousTopBid.user_id)) return;

  try {
    const previousBidder = await client.users.fetch(previousTopBid.user_id);
    await previousBidder.send({
      components: [OutbidDMComponents({ lot, auction, newAmount, guildId })],
      flags: [MessageFlags.IsComponentsV2],
    });
  } catch (err) {
    client.logger.error(`auctionBidFlow: failed to send outbid DM to ${previousTopBid.user_id}:`, err);
  }
}

async function logBid(client: SapphireClient, bid: BidRow, lot: AuctionLotRow) {
  const logChannelId = Constants.AUCTION_BID_LOG_CHANNEL_ID;
  if (!logChannelId) {
    client.logger.warn(`auctionBidFlow: AUCTION_BID_LOG_CHANNEL_ID is not configured; skipping bid log for bid ${bid.id}.`);
    return;
  }

  try {
    const channel = client.channels.cache.get(logChannelId) ?? (await client.channels.fetch(logChannelId));
    if (!channel?.isSendable()) {
      client.logger.warn(`auctionBidFlow: bid log channel ${logChannelId} is not sendable.`);
      return;
    }

    const message = await channel.send({
      components: [BidLogComponents({ bid, lot })],
      flags: [MessageFlags.IsComponentsV2],
    });
    Database.updateBidLogMessage({ bidId: bid.id, channelId: logChannelId, messageId: message.id });
  } catch (err) {
    client.logger.error(`auctionBidFlow: failed to log bid ${bid.id}:`, err);
  }
}

export async function placeAuctionBid({ client, userId, guildId, lot, auction, amount }: PlaceAuctionBidInput): Promise<PlaceAuctionBidResult> {
  const previousTopBid = Database.getTopBid(lot.id);
  const result = Database.insertBid({ lot_id: lot.id, user_id: userId, amount });
  if (!result) {
    return { status: 'outbid', currentTopBid: Database.getTopBid(lot.id) };
  }

  const bid = Database.getBid(Number(result.lastInsertRowid));
  const topBid = Database.getTopBid(lot.id);
  if (!bid || !topBid) {
    throw new Error(`auctionBidFlow: could not rehydrate placed bid for lot ${lot.id}.`);
  }

  await refreshAuctionLotMessage(client, lot, topBid);
  await sendOutbidDm({ client, previousTopBid, lot, auction, newAmount: amount, guildId });
  await logBid(client, bid, lot);

  return { status: 'placed', bid, topBid };
}

export async function revertAuctionBid({ client, bidId, revertedBy, reason }: RevertAuctionBidInput): Promise<RevertAuctionBidResult> {
  const bid = Database.getBid(bidId);
  if (!bid) return { status: 'missing-bid' };
  if (bid.reverted_at != null) return { status: 'already-reverted' };

  const lot = Database.getAuctionLot(bid.lot_id);
  if (!lot) return { status: 'missing-lot' };

  const auction = Database.getAuction(lot.auction_id);
  const now = Math.floor(Date.now() / 1000);
  if (!auction || auction.end_time <= now) return { status: 'auction-ended' };

  const reverted = Database.softDeleteBid({ bidId, revertedBy, reason });
  if (!reverted) return { status: 'already-reverted' };

  const updatedBid = Database.getBid(bidId);
  if (!updatedBid) return { status: 'missing-bid' };

  await refreshAuctionLotMessage(client, lot, Database.getTopBid(lot.id));

  return { status: 'reverted', bid: updatedBid, lot };
}

export async function disableAuctionBidUndoButtons(client: SapphireClient, auctionId: string) {
  const activeBidLogs = Database.getActiveBidLogsForAuction(auctionId);

  for (const bid of activeBidLogs) {
    if (!bid.bid_log_channel_id || !bid.bid_log_message_id) continue;

    const lot = Database.getAuctionLot(bid.lot_id);
    if (!lot) continue;

    try {
      const channel = client.channels.cache.get(bid.bid_log_channel_id) ?? (await client.channels.fetch(bid.bid_log_channel_id));
      if (!channel?.isTextBased()) continue;

      const message = await channel.messages.fetch(bid.bid_log_message_id);
      await message.edit({
        components: [BidLogComponents({ bid, lot, includeUndo: false, note: 'Auction complete. Undo is no longer available.' })],
        flags: [MessageFlags.IsComponentsV2],
      });
    } catch (err) {
      client.logger.error(`auctionBidFlow: failed to disable undo button for bid ${bid.id}:`, err);
    }
  }
}
