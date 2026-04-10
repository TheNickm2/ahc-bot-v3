import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { Database, ReminderScheduler } from '../state/state';
import { AuctionReminderOptInComponents } from '../utils/messageComponentUtil';

interface ParseResult {
  auctionId: string;
  offsetSeconds: number;
}

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction, { auctionId, offsetSeconds }: ParseResult) {
    await interaction.deferUpdate();

    const auction = Database.getAuction(auctionId);
    const now = Math.floor(Date.now() / 1000);
    if (!auction || auction.end_time <= now) {
      return interaction.editReply({ content: 'This auction has already ended.', components: [] });
    }

    const remindAt = auction.end_time - offsetSeconds;
    const userId = interaction.user.id;

    // Only toggle if the reminder time hasn't already passed
    if (remindAt > now) {
      const existing = Database.getAuctionReminderForUser(auctionId, userId, offsetSeconds);
      if (existing) {
        // Toggle off: cancel and delete the scheduled reminder
        ReminderScheduler.cancelReminder(existing.id);
      } else {
        // Toggle on: insert and schedule a new reminder
        const result = Database.insertReminder({
          user_id: userId,
          channel_id: auction.channel_id,
          message: `⏰ An auction you are watching is ending <t:${auction.end_time}:R>! Head over to <#${auction.channel_id}> to place your bids.`,
          remind_at: remindAt,
          auction_id: auctionId,
        });
        ReminderScheduler.scheduleReminder(Number(result.lastInsertRowid));
      }
    }

    // Re-fetch all 3 states and update the ephemeral in place
    const dayReminder = Database.getAuctionReminderForUser(auctionId, userId, 86400);
    const hourReminder = Database.getAuctionReminderForUser(auctionId, userId, 3600);
    const minReminder = Database.getAuctionReminderForUser(auctionId, userId, 900);

    return interaction.editReply({
      flags: [MessageFlags.IsComponentsV2],
      components: [
        AuctionReminderOptInComponents({
          auctionId,
          auctionEndTime: auction.end_time,
          states: {
            day: !!dayReminder,
            hour: !!hourReminder,
            min: !!minReminder,
          },
        }),
      ],
    });
  }

  public override parse(interaction: ButtonInteraction) {
    const prefix = `${Constants.BUTTON_IDS.AUCTION_REMIND_TOGGLE}:`;
    if (!interaction.customId.startsWith(prefix)) return this.none();
    const remainder = interaction.customId.slice(prefix.length);
    const colonIdx = remainder.lastIndexOf(':');
    if (colonIdx === -1) return this.none();
    const auctionId = remainder.slice(0, colonIdx);
    const offsetSeconds = parseInt(remainder.slice(colonIdx + 1), 10);
    if (!auctionId || isNaN(offsetSeconds)) return this.none();
    return this.some({ auctionId, offsetSeconds });
  }
}
