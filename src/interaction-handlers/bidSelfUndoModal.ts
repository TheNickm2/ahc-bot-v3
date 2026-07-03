import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ModalSubmitInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';
import { closeBidderUndoWindow, revertAuctionBid, updateBidLogMessageAsReverted } from '../utils/auctionBidFlow';

const MODAL_PREFIX = `${Constants.BUTTON_IDS.BID_SELF_UNDO_REASON}:`;

interface ParseResult {
  bidId: number;
}

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class ModalHandler extends InteractionHandler {
  public async run(interaction: ModalSubmitInteraction, { bidId }: ParseResult) {
    const isFromMessage = interaction.isFromMessage();
    if (isFromMessage) {
      await interaction.deferUpdate();
    } else {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    }

    const reason = interaction.fields.getTextInputValue('undo_reason').trim();
    if (!reason) {
      if (isFromMessage) return interaction.followUp({ content: 'A reason is required to undo this bid.' });
      return interaction.editReply({ content: 'A reason is required to undo this bid.' });
    }

    const bid = Database.getBid(bidId);
    const now = Math.floor(Date.now() / 1000);

    if (!bid || bid.reverted_at != null) {
      if (isFromMessage) return interaction.followUp({ content: 'This bid has already been reverted or could not be found.' });
      return interaction.editReply({ content: 'This bid has already been reverted or could not be found.' });
    }

    if (bid.user_id !== interaction.user.id) {
      if (isFromMessage) return interaction.followUp({ content: 'You can only undo your own bid.' });
      return interaction.editReply({ content: 'You can only undo your own bid.' });
    }

    if (!bid.bidder_undo_until || bid.bidder_undo_until <= now) {
      await closeBidderUndoWindow(interaction.client, bidId, 'expired');
      if (isFromMessage)
        return interaction.followUp({ content: 'You may no longer revert your own bid. Please contact an officer if you need help.' });
      return interaction.editReply({ content: 'You may no longer revert your own bid. Please contact an officer if you need help.' });
    }

    const lot = Database.getAuctionLot(bid.lot_id);
    if (!lot) {
      if (isFromMessage) return interaction.followUp({ content: 'The lot for this bid could not be found.' });
      return interaction.editReply({ content: 'The lot for this bid could not be found.' });
    }

    const auction = Database.getAuction(lot.auction_id);
    if (!auction || auction.end_time <= now) {
      await closeBidderUndoWindow(interaction.client, bidId, 'auction-ended');
      if (isFromMessage) return interaction.followUp({ content: 'This auction has already ended. Undo is no longer available.' });
      return interaction.editReply({ content: 'This auction has already ended. Undo is no longer available.' });
    }

    const topBid = Database.getTopBid(lot.id);
    if (!topBid || topBid.id !== bidId) {
      await closeBidderUndoWindow(interaction.client, bidId, 'outbid');
      if (isFromMessage) return interaction.followUp({ content: 'This bid is no longer the current top bid, so it cannot be self-reverted.' });
      return interaction.editReply({ content: 'This bid is no longer the current top bid, so it cannot be self-reverted.' });
    }

    const result = await revertAuctionBid({
      client: interaction.client,
      bidId,
      revertedBy: interaction.user.id,
      reason,
    });

    switch (result.status) {
      case 'missing-bid':
        if (isFromMessage) return interaction.followUp({ content: 'This bid could not be found.' });
        return interaction.editReply({ content: 'This bid could not be found.' });
      case 'already-reverted':
        if (isFromMessage) return interaction.followUp({ content: 'This bid has already been reverted.' });
        return interaction.editReply({ content: 'This bid has already been reverted.' });
      case 'missing-lot':
        if (isFromMessage) return interaction.followUp({ content: 'The lot for this bid could not be found.' });
        return interaction.editReply({ content: 'The lot for this bid could not be found.' });
      case 'auction-ended':
        await closeBidderUndoWindow(interaction.client, bidId, 'auction-ended');
        if (isFromMessage) return interaction.followUp({ content: 'This auction has already ended. Undo is no longer available.' });
        return interaction.editReply({ content: 'This auction has already ended. Undo is no longer available.' });
      case 'reverted': {
        await closeBidderUndoWindow(interaction.client, bidId, 'reverted');
        await updateBidLogMessageAsReverted(interaction.client, result.bid, result.lot);

        const officerRoleId = Constants.AUCTION_OFFICER_ROLE_ID;
        const mention = officerRoleId ? `<@&${officerRoleId}> ` : '';
        const alertChannelId = result.bid.bid_log_channel_id ?? Constants.AUCTION_BID_LOG_CHANNEL_ID;

        if (alertChannelId) {
          try {
            const channel = interaction.client.channels.cache.get(alertChannelId) ?? (await interaction.client.channels.fetch(alertChannelId));
            if (channel?.isSendable()) {
              await channel.send({
                content:
                  `${mention}User self-reverted a bid.\n` +
                  `**Bidder:** <@${interaction.user.id}>\n` +
                  `**Bid:** #${result.bid.id} (${Constants.EMOTES.COIN} ${result.bid.amount!.toLocaleString('en-us')})\n` +
                  `**Lot:** ${result.lot.lot_number}: ${result.lot.title} (ID: ${result.lot.id})\n` +
                  `**Reason:** ${reason}\n` +
                  `**Reverted At:** <t:${result.bid.reverted_at}:F>`,
                ...(officerRoleId ? { allowedMentions: { roles: [officerRoleId] } } : {}),
              });
            }
          } catch (err) {
            interaction.client.logger.error(`bidSelfUndoModal: failed to post officer alert for bid ${bidId}:`, err);
          }
        }

        if (isFromMessage) {
          return interaction.followUp({ content: `Your bid #${bidId} has been reverted.` });
        }

        return interaction.editReply({ content: `Your bid #${bidId} has been reverted.` });
      }
    }
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith(MODAL_PREFIX)) return this.none();
    const bidId = parseInt(interaction.customId.slice(MODAL_PREFIX.length), 10);
    if (Number.isNaN(bidId)) return this.none();
    return this.some({ bidId });
  }
}
