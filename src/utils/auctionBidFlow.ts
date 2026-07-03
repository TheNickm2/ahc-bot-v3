import nodeSchedule from 'node-schedule';
import type { SapphireClient } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';
import type { AuctionLotRow, AuctionRow, BidRow } from '../types/database';
import {
  AuctionLotWithBidComponents,
  AuctionSummaryMessageComponents,
  BidLogComponents,
  BidPlacedDMComponents,
  OutbidDMComponents,
  RevertedBidLogComponents,
} from './messageComponentUtil';

interface PlaceAuctionBidInput {
  client: SapphireClient;
  userId: string;
  guildId: string;
  lot: AuctionLotRow;
  auction: AuctionRow;
  amount: number;
}

type PlaceAuctionBidResult =
  | { status: 'placed'; bid: BidRow; topBid: BidRow; confirmationDmSent: boolean }
  | { status: 'outbid'; currentTopBid?: BidRow };

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

const USER_UNDO_WINDOW_SECONDS = 300;

type BidderUndoCloseReason = 'expired' | 'outbid' | 'auction-ended' | 'reverted';

function bidderUndoJobName(bidId: number) {
  return `bidder-undo-expire:${bidId}`;
}

function getBidLotUrl(guildId: string, lot: AuctionLotRow): string | undefined {
  if (!lot.channel_id || !lot.message_id) return undefined;
  return `https://discord.com/channels/${guildId}/${lot.channel_id}/${lot.message_id}`;
}

function bidderUndoClosureNote(reason: BidderUndoCloseReason): string {
  switch (reason) {
    case 'outbid':
      return 'This undo option is no longer available because this bid has been outbid. If you need help or spot an error, please contact an officer.';
    case 'auction-ended':
      return 'This undo option is no longer available because the auction has ended. If you need help or spot an error, please contact an officer.';
    case 'reverted':
      return 'This bid has already been reverted. If you need help or spot an error, please contact an officer.';
    case 'expired':
    default:
      return 'The self-serve undo window has expired. If you need help or spot an error, please contact an officer.';
  }
}

function scheduleBidderUndoExpiry(client: SapphireClient, bid: BidRow) {
  if (!bid.bidder_undo_until) return;

  const existing = nodeSchedule.scheduledJobs[bidderUndoJobName(bid.id)];
  if (existing) existing.cancel();

  const runAt = new Date(bid.bidder_undo_until * 1000);
  if (runAt <= new Date()) {
    void closeBidderUndoWindow(client, bid.id, 'expired');
    return;
  }

  nodeSchedule.scheduleJob(bidderUndoJobName(bid.id), runAt, async () => {
    await closeBidderUndoWindow(client, bid.id, 'expired');
  });
}

async function sendBidConfirmationDm({
  client,
  bid,
  lot,
  guildId,
}: {
  client: SapphireClient;
  bid: BidRow;
  lot: AuctionLotRow;
  guildId: string;
}): Promise<{ channelId: string; messageId: string } | null> {
  if (!bid.user_id) return null;

  try {
    const user = await client.users.fetch(bid.user_id);
    const dmMessage = await user.send({
      components: [BidPlacedDMComponents({ bid, lot, lotUrl: getBidLotUrl(guildId, lot) })],
      flags: [MessageFlags.IsComponentsV2],
    });
    return { channelId: dmMessage.channel.id, messageId: dmMessage.id };
  } catch (err) {
    client.logger.warn(`auctionBidFlow: failed to send bid confirmation DM for bid ${bid.id}.`, err);
    return null;
  }
}

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

export async function updateAuctionSummaryMessage(client: SapphireClient, auctionId: string, options?: { isEnded?: boolean }) {
  const auction = Database.getAuction(auctionId);
  if (!auction?.summary_message_id) return;

  try {
    const channel = client.channels.cache.get(auction.channel_id) ?? (await client.channels.fetch(auction.channel_id));
    if (!channel?.isTextBased()) return;
    if (!('guild' in channel)) return;

    const summaryMessage = await channel.messages.fetch(auction.summary_message_id);
    const lots = Database.getAuctionLotSummaries(auctionId);
    await summaryMessage.edit({
      components: [
        AuctionSummaryMessageComponents({
          lots,
          endDate: new Date(auction.end_time * 1000),
          channel,
          auctionId,
          isTest: auction.is_test === 1,
          isEnded: options?.isEnded,
        }),
      ],
      flags: [MessageFlags.IsComponentsV2],
    });
  } catch (err) {
    client.logger.error(`auctionBidFlow: failed to refresh auction summary for auction ${auctionId}:`, err);
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
  await updateAuctionSummaryMessage(client, lot.auction_id);

  if (previousTopBid?.id) {
    await closeBidderUndoWindow(client, previousTopBid.id, 'outbid');
  }

  await sendOutbidDm({ client, previousTopBid, lot, auction, newAmount: amount, guildId });
  await logBid(client, bid, lot);

  const undoUntil = Math.min((bid.created_at ?? Math.floor(Date.now() / 1000)) + USER_UNDO_WINDOW_SECONDS, auction.end_time);
  const confirmation = await sendBidConfirmationDm({ client, bid, lot, guildId });
  if (confirmation) {
    Database.updateBidderConfirmationMessage({
      bidId: bid.id,
      channelId: confirmation.channelId,
      messageId: confirmation.messageId,
      undoUntil,
    });
    const refreshedBid = Database.getBid(bid.id);
    if (refreshedBid) {
      scheduleBidderUndoExpiry(client, refreshedBid);
    }
  }

  return { status: 'placed', bid, topBid, confirmationDmSent: !!confirmation };
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
  await updateAuctionSummaryMessage(client, lot.auction_id);

  return { status: 'reverted', bid: updatedBid, lot };
}

export async function updateBidLogMessageAsReverted(client: SapphireClient, bid: BidRow, lot: AuctionLotRow): Promise<void> {
  if (!bid.bid_log_channel_id || !bid.bid_log_message_id) return;

  try {
    const channel = client.channels.cache.get(bid.bid_log_channel_id) ?? (await client.channels.fetch(bid.bid_log_channel_id));
    if (!channel?.isTextBased()) return;

    const message = await channel.messages.fetch(bid.bid_log_message_id);
    await message.edit({
      components: [RevertedBidLogComponents({ bid, lot })],
      flags: [MessageFlags.IsComponentsV2],
    });
  } catch (err) {
    client.logger.error(`auctionBidFlow: failed to update bid log message for reverted bid ${bid.id}:`, err);
  }
}

export async function closeBidderUndoWindow(client: SapphireClient, bidId: number, reason: BidderUndoCloseReason): Promise<void> {
  const bid = Database.getBid(bidId);
  if (!bid || bid.bidder_undo_until == null) return;

  const job = nodeSchedule.scheduledJobs[bidderUndoJobName(bidId)];
  if (job) job.cancel();

  const lot = Database.getAuctionLot(bid.lot_id);
  if (!lot) {
    Database.clearBidderUndoWindow(bidId);
    return;
  }

  if (bid.bidder_confirmation_channel_id && bid.bidder_confirmation_message_id && bid.user_id) {
    try {
      const channel =
        client.channels.cache.get(bid.bidder_confirmation_channel_id) ?? (await client.channels.fetch(bid.bidder_confirmation_channel_id));
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(bid.bidder_confirmation_message_id);
        await message.edit({
          components: [
            BidPlacedDMComponents({
              bid,
              lot,
              includeUndo: false,
              note: bidderUndoClosureNote(reason),
            }),
          ],
          flags: [MessageFlags.IsComponentsV2],
        });
      }
    } catch (err) {
      client.logger.warn(`auctionBidFlow: failed to close bidder undo window DM for bid ${bid.id}.`, err);
    }
  }

  Database.clearBidderUndoWindow(bidId);
}

export async function closeBidderUndoWindowsForAuction(client: SapphireClient, auctionId: string): Promise<void> {
  const openBids = Database.getBidsWithOpenBidderUndoWindowForAuction(auctionId);
  for (const bid of openBids) {
    await closeBidderUndoWindow(client, bid.id, 'auction-ended');
  }
}

export async function rehydrateBidderUndoWindowJobs(client: SapphireClient): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const openBids = Database.getBidsWithOpenBidderUndoWindow();

  for (const bid of openBids) {
    if (!bid.bidder_undo_until || bid.bidder_undo_until <= now) {
      await closeBidderUndoWindow(client, bid.id, 'expired');
      continue;
    }
    scheduleBidderUndoExpiry(client, bid);
  }
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
