import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, type ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';

const SELF_UNDO_PREFIX = `${Constants.BUTTON_IDS.BID_SELF_UNDO}:`;

interface ParseResult {
  bidId: number;
}

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction, { bidId }: ParseResult) {
    const bid = Database.getBid(bidId);
    const now = Math.floor(Date.now() / 1000);

    if (!bid || bid.reverted_at != null) {
      return interaction.reply({ content: 'This bid has already been reverted or could not be found.' });
    }

    if (bid.user_id !== interaction.user.id) {
      return interaction.reply({ content: 'You can only undo your own bid.' });
    }

    if (!bid.bidder_undo_until || bid.bidder_undo_until <= now) {
      return interaction.reply({ content: 'You may no longer revert your own bid. Please contact an officer if you need help.' });
    }

    const lot = Database.getAuctionLot(bid.lot_id);
    const auction = lot ? Database.getAuction(lot.auction_id) : undefined;
    if (!lot || !auction || auction.end_time <= now) {
      return interaction.reply({ content: 'This auction has already ended. Undo is no longer available.' });
    }

    const topBid = Database.getTopBid(lot.id);
    if (!topBid || topBid.id !== bidId) {
      return interaction.reply({ content: 'This bid is no longer the current top bid, so it cannot be self-reverted.' });
    }

    const modal = new ModalBuilder()
      .setCustomId(`${Constants.BUTTON_IDS.BID_SELF_UNDO_REASON}:${bidId}`)
      .setTitle(`Undo Bid #${bidId}`)
      .addLabelComponents(
        new LabelBuilder()
          .setLabel('Reason for undoing this bid')
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId('undo_reason')
              .setPlaceholder('Please explain why you are undoing this bid')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMinLength(3)
              .setMaxLength(500),
          ),
      );

    return interaction.showModal(modal);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith(SELF_UNDO_PREFIX)) return this.none();
    const bidId = parseInt(interaction.customId.slice(SELF_UNDO_PREFIX.length), 10);
    if (Number.isNaN(bidId)) return this.none();
    return this.some({ bidId });
  }
}
