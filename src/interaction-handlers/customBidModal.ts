import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ModalSubmitInteraction } from 'discord.js';
import numeral from 'numeral';
import { Constants } from '../config/constants';
import { Database } from '../state/state';
import { placeAuctionBid } from '../utils/auctionBidFlow';

const MODAL_PREFIX = `${Constants.BUTTON_IDS.BID_CUSTOM}-modal:`;

interface ParseResult {
  lotId: number;
}

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class ModalHandler extends InteractionHandler {
  public async run(interaction: ModalSubmitInteraction, { lotId }: ParseResult) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const rawValue = interaction.fields.getTextInputValue('bid_amount');
    const parsedAmount = numeral(rawValue).value();

    if (!parsedAmount || parsedAmount <= 0) {
      return interaction.editReply({
        content: 'Could not parse your bid. Please enter a number like `50000` or `50k`.',
      });
    }

    if (parsedAmount % 1000 !== 0) {
      return interaction.editReply({
        content: 'Bids must be a multiple of **1,000g**.',
      });
    }

    const lot = Database.getAuctionLot(lotId);
    if (!lot) {
      return interaction.editReply({ content: 'This lot could not be found.' });
    }

    const auction = Database.getAuction(lot.auction_id);
    const now = Math.floor(Date.now() / 1000);
    if (!auction || auction.end_time <= now) {
      return interaction.editReply({ content: 'This auction has already ended.' });
    }

    const topBid = Database.getTopBid(lotId);
    const minRequired = topBid ? topBid.amount! + 1000 : lot.starting_bid!;

    if (parsedAmount < minRequired) {
      return interaction.editReply({
        content: `Minimum bid is **${minRequired.toLocaleString('en-us')}g**.`,
      });
    }

    const result = await placeAuctionBid({
      client: interaction.client,
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      lot,
      auction,
      amount: parsedAmount,
    });

    if (result.status === 'outbid') {
      return interaction.editReply({
        content: `Someone else bid at the same time! Current top bid: **${result.currentTopBid?.amount?.toLocaleString('en-us') ?? 'unknown'}g**. Please bid again.`,
      });
    }

    return interaction.editReply({
      content: `Your bid of **${parsedAmount.toLocaleString('en-us')}g** has been placed!`,
    });
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith(MODAL_PREFIX)) return this.none();
    const lotId = parseInt(interaction.customId.slice(MODAL_PREFIX.length), 10);
    if (isNaN(lotId)) return this.none();
    return this.some({ lotId });
  }
}
