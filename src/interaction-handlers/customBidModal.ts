import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ModalSubmitInteraction } from 'discord.js';
import numeral from 'numeral';
import { Constants } from '../config/constants';
import { Database } from '../state/state';
import { BidConfirmationComponents } from '../utils/messageComponentUtil';

const MODAL_PREFIX = `${Constants.BUTTON_IDS.BID_CUSTOM}-modal:`;

interface ParseResult {
  lotId: number;
}

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class ModalHandler extends InteractionHandler {
  public async run(interaction: ModalSubmitInteraction, { lotId }: ParseResult) {
    const rawValue = interaction.fields.getTextInputValue('bid_amount');
    const parsedAmount = numeral(rawValue).value();

    if (!parsedAmount || parsedAmount <= 0) {
      return interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: 'Could not parse your bid. Please enter a number like `50000` or `50k`.',
      });
    }

    if (parsedAmount % 1000 !== 0) {
      return interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: 'Bids must be a multiple of **1,000g**.',
      });
    }

    const lot = Database.getAuctionLot(lotId);
    if (!lot) {
      return interaction.reply({ flags: [MessageFlags.Ephemeral], content: 'This lot could not be found.' });
    }

    const auction = Database.getAuction(lot.auction_id);
    const now = Math.floor(Date.now() / 1000);
    if (!auction || auction.end_time <= now) {
      return interaction.reply({ flags: [MessageFlags.Ephemeral], content: 'This auction has already ended.' });
    }

    const topBid = Database.getTopBid(lotId);
    const minRequired = topBid ? topBid.amount! + 1000 : lot.starting_bid!;

    if (parsedAmount < minRequired) {
      return interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: `Minimum bid is **${minRequired.toLocaleString('en-us')}g**.`,
      });
    }

    return interaction.reply({
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      components: [BidConfirmationComponents({ lotId, parsedAmount, lotTitle: lot.title ?? `Lot ${lot.lot_number}` })],
    });
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith(MODAL_PREFIX)) return this.none();
    const lotId = parseInt(interaction.customId.slice(MODAL_PREFIX.length), 10);
    if (isNaN(lotId)) return this.none();
    return this.some({ lotId });
  }
}
