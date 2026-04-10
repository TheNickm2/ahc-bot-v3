import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, type ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';

interface ParseResult {
  lotId: number;
}

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction, { lotId }: ParseResult) {
    const lot = Database.getAuctionLot(lotId);
    if (!lot) return;

    const auction = Database.getAuction(lot.auction_id);
    const now = Math.floor(Date.now() / 1000);
    if (!auction || auction.end_time <= now) return;

    const topBid = Database.getTopBid(lotId);
    const minBid = topBid ? topBid.amount! + 1000 : lot.starting_bid!;

    const modal = new ModalBuilder()
      .setCustomId(`${Constants.BUTTON_IDS.BID_CUSTOM}-modal:${lotId}`)
      .setTitle(`Bid on Lot ${lot.lot_number}: ${lot.title}`)
      .addLabelComponents(
        new LabelBuilder()
          .setLabel(`Minimum bid: ${minBid.toLocaleString('en-us')}g`)
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId('bid_amount')
              .setLabel('Your bid amount')
              .setPlaceholder('e.g. 50000 or 50k')
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          ),
      );

    return interaction.showModal(modal);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith(`${Constants.BUTTON_IDS.BID_CUSTOM}:`)) return this.none();
    const lotId = parseInt(interaction.customId.split(':')[1], 10);
    if (isNaN(lotId)) return this.none();
    return this.some({ lotId });
  }
}
