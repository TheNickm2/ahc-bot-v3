import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ModalSubmitInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { revertAuctionBid } from '../utils/auctionBidFlow';
import { RevertedBidLogComponents } from '../utils/messageComponentUtil';

const MODAL_PREFIX = `${Constants.BUTTON_IDS.BID_UNDO_REASON}:`;

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
      if (isFromMessage) {
        return interaction.followUp({
          flags: [MessageFlags.Ephemeral],
          content: 'A reason is required to revert this bid.',
        });
      }

      return interaction.editReply({ content: 'A reason is required to revert this bid.' });
    }

    const result = await revertAuctionBid({
      client: interaction.client,
      bidId,
      revertedBy: interaction.user.id,
      reason,
    });

    switch (result.status) {
      case 'missing-bid':
        if (isFromMessage) return interaction.followUp({ flags: [MessageFlags.Ephemeral], content: 'This bid could not be found.' });
        return interaction.editReply({ content: 'This bid could not be found.' });
      case 'already-reverted':
        if (isFromMessage) return interaction.followUp({ flags: [MessageFlags.Ephemeral], content: 'This bid has already been reverted.' });
        return interaction.editReply({ content: 'This bid has already been reverted.' });
      case 'missing-lot':
        if (isFromMessage) return interaction.followUp({ flags: [MessageFlags.Ephemeral], content: 'The lot for this bid could not be found.' });
        return interaction.editReply({ content: 'The lot for this bid could not be found.' });
      case 'auction-ended':
        if (isFromMessage)
          return interaction.followUp({ flags: [MessageFlags.Ephemeral], content: 'This auction has already ended. Undo is no longer available.' });
        return interaction.editReply({ content: 'This auction has already ended. Undo is no longer available.' });
      case 'reverted':
        if (!isFromMessage) {
          return interaction.editReply({ content: 'Bid reverted, but the log message could not be updated automatically.' });
        }

        await interaction.editReply({
          components: [RevertedBidLogComponents({ bid: result.bid, lot: result.lot })],
        });

        return interaction.followUp({
          flags: [MessageFlags.Ephemeral],
          content: `Bid #${bidId} has been reverted.`,
        });
    }
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith(MODAL_PREFIX)) return this.none();
    const bidId = parseInt(interaction.customId.slice(MODAL_PREFIX.length), 10);
    if (Number.isNaN(bidId)) return this.none();
    return this.some({ bidId });
  }
}
