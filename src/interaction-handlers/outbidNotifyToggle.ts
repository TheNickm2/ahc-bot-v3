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
    await interaction.deferUpdate();

    const auction = Database.getAuction(auctionId);
    const now = Math.floor(Date.now() / 1000);
    if (!auction || auction.end_time <= now) {
      return interaction.editReply({ content: 'This auction has already ended.', components: [] });
    }

    const userId = interaction.user.id;
    const existing = Database.getOutbidSubscription(auctionId, userId);
    if (existing) {
      Database.deleteOutbidSubscription(auctionId, userId);
    } else {
      Database.insertOutbidSubscription(auctionId, userId);
    }

    const isSubscribed = !!Database.getOutbidSubscription(auctionId, userId);

    return interaction.editReply({
      flags: [MessageFlags.IsComponentsV2],
      components: [OutbidNotifyComponents({ auctionId, isSubscribed })],
    });
  }

  public override parse(interaction: ButtonInteraction) {
    const prefix = `${Constants.BUTTON_IDS.OUTBID_NOTIFY_TOGGLE}:`;
    if (!interaction.customId.startsWith(prefix)) return this.none();
    const auctionId = interaction.customId.slice(prefix.length);
    if (!auctionId) return this.none();
    return this.some({ auctionId });
  }
}
