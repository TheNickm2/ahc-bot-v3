import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';
import { getCallerLocation } from '../utils/interactionUtils';
import { placeAuctionBid } from '../utils/auctionBidFlow';

interface ParseResult {
  lotId: number;
}

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction, { lotId }: ParseResult) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const lot = Database.getAuctionLot(lotId);
    if (!lot || !lot.message_id || !lot.channel_id) {
      return interaction.editReply({
        content: `This lot could not be found. Please contact an officer. *(${getCallerLocation()})*`,
      });
    }

    const auction = Database.getAuction(lot.auction_id);
    const now = Math.floor(Date.now() / 1000);
    if (!auction || auction.end_time <= now) {
      return interaction.editReply({ content: 'This auction has already ended.' });
    }

    const topBid = Database.getTopBid(lotId);
    const newAmount = (topBid?.amount ?? lot.starting_bid!) + 100000;

    const result = await placeAuctionBid({
      client: interaction.client,
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      lot,
      auction,
      amount: newAmount,
    });
    if (result.status === 'outbid') {
      return interaction.editReply({
        content: `Someone else bid at the same time! Current top bid: **${result.currentTopBid?.amount?.toLocaleString('en-us') ?? 'unknown'}g**. Please try again.`,
      });
    }

    return interaction.editReply({
      content: `Your bid of **${newAmount.toLocaleString('en-us')}g** has been placed!`,
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith(`${Constants.BUTTON_IDS.BID_QUICK}:`)) return this.none();
    const lotId = parseInt(interaction.customId.split(':')[1], 10);
    if (isNaN(lotId)) return this.none();
    return this.some({ lotId });
  }
}
