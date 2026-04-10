import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';
import { OutbidNotifyComponents } from '../utils/messageComponentUtil';

interface ParseResult {
  auctionId: string;
}

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction, { auctionId }: ParseResult) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const auction = Database.getAuction(auctionId);
    const now = Math.floor(Date.now() / 1000);
    if (!auction || auction.end_time <= now) {
      return interaction.editReply({ content: 'This auction has already ended.' });
    }

    const isSubscribed = !!Database.getOutbidSubscription(auctionId, interaction.user.id);

    const dmComponents = OutbidNotifyComponents({ auctionId, isSubscribed });

    try {
      await interaction.user.send({
        components: [dmComponents],
        flags: [MessageFlags.IsComponentsV2],
      });
      return interaction.editReply({ content: 'Check your DMs! You can toggle outbid alerts from there. 📬' });
    } catch {
      // DMs are closed — fall back to ephemeral
      return interaction.editReply({
        flags: [MessageFlags.IsComponentsV2],
        components: [dmComponents],
      });
    }
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith(`${Constants.BUTTON_IDS.OUTBID_NOTIFY}:`)) return this.none();
    const auctionId = interaction.customId.slice(`${Constants.BUTTON_IDS.OUTBID_NOTIFY}:`.length);
    if (!auctionId) return this.none();
    return this.some({ auctionId });
  }
}
