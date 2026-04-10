import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';
import { AuctionReminderOptInComponents } from '../utils/messageComponentUtil';

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

    const userId = interaction.user.id;
    const dayReminder = Database.getAuctionReminderForUser(auctionId, userId, 86400);
    const hourReminder = Database.getAuctionReminderForUser(auctionId, userId, 3600);
    const minReminder = Database.getAuctionReminderForUser(auctionId, userId, 900);

    const dmComponents = AuctionReminderOptInComponents({
      auctionId,
      auctionEndTime: auction.end_time,
      states: {
        day: !!dayReminder,
        hour: !!hourReminder,
        min: !!minReminder,
      },
    });

    try {
      await interaction.user.send({
        components: [dmComponents],
        flags: [MessageFlags.IsComponentsV2],
      });
      return interaction.editReply({ content: 'Check your DMs! You can toggle your reminders from there. 📬' });
    } catch {
      // DMs are closed — fall back to ephemeral
      return interaction.editReply({
        flags: [MessageFlags.IsComponentsV2],
        components: [dmComponents],
      });
    }
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith(`${Constants.BUTTON_IDS.AUCTION_REMIND}:`)) return this.none();
    const auctionId = interaction.customId.slice(`${Constants.BUTTON_IDS.AUCTION_REMIND}:`.length);
    if (!auctionId) return this.none();
    return this.some({ auctionId });
  }
}
