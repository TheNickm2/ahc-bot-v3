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
    const reason = interaction.fields.getTextInputValue('undo_reason').trim();
    if (!reason) {
      return interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: 'A reason is required to revert this bid.',
      });
    }

    const result = await revertAuctionBid({
      client: interaction.client,
      bidId,
      revertedBy: interaction.user.id,
      reason,
    });

    switch (result.status) {
      case 'missing-bid':
        return interaction.reply({ flags: [MessageFlags.Ephemeral], content: 'This bid could not be found.' });
      case 'already-reverted':
        return interaction.reply({ flags: [MessageFlags.Ephemeral], content: 'This bid has already been reverted.' });
      case 'missing-lot':
        return interaction.reply({ flags: [MessageFlags.Ephemeral], content: 'The lot for this bid could not be found.' });
      case 'auction-ended':
        return interaction.reply({ flags: [MessageFlags.Ephemeral], content: 'This auction has already ended. Undo is no longer available.' });
      case 'reverted':
        if (!interaction.isFromMessage()) {
          return interaction.reply({
            flags: [MessageFlags.Ephemeral],
            content: 'Bid reverted, but the log message could not be updated automatically.',
          });
        }

        return interaction.update({
          components: [RevertedBidLogComponents({ bid: result.bid, lot: result.lot })],
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
