import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';
import { AuctionLotWithBidComponents } from '../utils/messageComponentUtil';

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
      return interaction.editReply({ content: 'This lot could not be found. Please contact an officer.' });
    }

    const auction = Database.getAuction(lot.auction_id);
    const now = Math.floor(Date.now() / 1000);
    if (!auction || auction.end_time <= now) {
      return interaction.editReply({ content: 'This auction has already ended.' });
    }

    const topBid = Database.getTopBid(lotId);
    const newAmount = (topBid?.amount ?? lot.starting_bid! - 1000) + 100000;

    const result = Database.insertBid({ lot_id: lotId, user_id: interaction.user.id, amount: newAmount });
    if (!result) {
      // Another bid was placed concurrently that matched or exceeded newAmount
      const updatedTop = Database.getTopBid(lotId);
      return interaction.editReply({
        content: `Someone else bid at the same time! Current top bid: **${updatedTop?.amount?.toLocaleString('en-us') ?? 'unknown'}g**. Please try again.`,
      });
    }

    // Edit the lot message to reflect the new bid
    const updatedTopBid = Database.getTopBid(lotId);
    try {
      const channel = interaction.client.channels.cache.get(lot.channel_id) ?? (await interaction.client.channels.fetch(lot.channel_id));
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(lot.message_id);
        await message.edit({
          components: [AuctionLotWithBidComponents({ lot, lotNumber: lot.lot_number!, topBid: updatedTopBid })],
          flags: [MessageFlags.IsComponentsV2],
        });
      }
    } catch (err) {
      interaction.client.logger.error(`quickBid: failed to edit lot message for lot ${lotId}:`, err);
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
