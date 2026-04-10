import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';
import { AuctionLotWithBidComponents } from '../utils/messageComponentUtil';

type ParseResult = { action: 'confirm'; lotId: number; amount: number } | { action: 'cancel' };

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction, data: ParseResult) {
    if (data.action === 'cancel') {
      return interaction.update({ components: [], content: 'Bid cancelled.' });
    }

    const { lotId, amount } = data;
    await interaction.deferUpdate();

    const lot = Database.getAuctionLot(lotId);
    if (!lot || !lot.message_id || !lot.channel_id) {
      return interaction.editReply({ content: 'This lot could not be found. Please contact an officer.', components: [] });
    }

    const auction = Database.getAuction(lot.auction_id);
    const now = Math.floor(Date.now() / 1000);
    if (!auction || auction.end_time <= now) {
      return interaction.editReply({ content: 'This auction has already ended.', components: [] });
    }

    const topBid = Database.getTopBid(lotId);
    const minRequired = topBid ? topBid.amount! + 1000 : lot.starting_bid!;

    if (amount < minRequired) {
      // Outbid since the modal was open
      return interaction.editReply({
        content: `You've been outbid since you opened the bid form. Current top bid: **${topBid!.amount!.toLocaleString('en-us')}g**. Please bid again.`,
        components: [],
      });
    }

    const result = Database.insertBid({ lot_id: lotId, user_id: interaction.user.id, amount });
    if (!result) {
      const updatedTop = Database.getTopBid(lotId);
      return interaction.editReply({
        content: `Someone else bid at the same time! Current top bid: **${updatedTop?.amount?.toLocaleString('en-us') ?? 'unknown'}g**. Please bid again.`,
        components: [],
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
      interaction.client.logger.error(`customBidConfirm: failed to edit lot message for lot ${lotId}:`, err);
    }

    return interaction.editReply({ content: `Bid of **${amount.toLocaleString('en-us')}g** placed! ✅`, components: [] });
  }

  public override parse(interaction: ButtonInteraction) {
    if (interaction.customId === Constants.BUTTON_IDS.BID_CANCEL) {
      return this.some({ action: 'cancel' } as ParseResult);
    }
    if (!interaction.customId.startsWith(`${Constants.BUTTON_IDS.BID_CONFIRM}:`)) return this.none();
    const parts = interaction.customId.split(':');
    const lotId = parseInt(parts[1], 10);
    const amount = parseInt(parts[2], 10);
    if (isNaN(lotId) || isNaN(amount)) return this.none();
    return this.some({ action: 'confirm', lotId, amount } as ParseResult);
  }
}
