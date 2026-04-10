import nodeSchedule from 'node-schedule';
import { container } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';
import { Database, ReminderScheduler } from '../state/state';
import { AuctionLotEndedComponents, WinnerDMMessageComponents } from './messageComponentUtil';
import type { LotWinnerRow } from '../types/database';

export class AuctionEndScheduler {
  constructor() {
    // Rehydrate: re-register the end job for any auction still active in the DB.
    // Mirrors the pattern used by ReminderScheduleManager.
    const activeAuction = Database.getActiveAuction();
    if (activeAuction) {
      const endDate = new Date(activeAuction.end_time * 1000);
      if (endDate > new Date()) {
        this.scheduleAuctionEnd(activeAuction.id, endDate, activeAuction.is_test === 1);
        console.log(`[AuctionEndScheduler] Rehydrated end job for auction ${activeAuction.id}.`);
      }
    }
  }

  public scheduleAuctionEnd(auctionId: string, endDate: Date, isTest: boolean): void {
    nodeSchedule.scheduleJob(`auction-end:${auctionId}`, endDate, async () => {
      await this.executeAuctionEnd(auctionId, isTest);
    });
  }

  public cancelAuctionEnd(auctionId: string): void {
    const job = nodeSchedule.scheduledJobs[`auction-end:${auctionId}`];
    if (job) {
      job.cancel();
      container.logger.debug(`[AuctionEndScheduler] Cancelled end job for auction ${auctionId}.`);
    }
  }

  private async executeAuctionEnd(auctionId: string, isTest: boolean): Promise<void> {
    container.logger.info(`[AuctionEndScheduler] Executing auction end for ${auctionId} (isTest: ${isTest}).`);

    // 1. Cancel any pending reminder jobs for this auction (they're no longer relevant)
    const reminders = Database.getAuctionReminders(auctionId);
    for (const reminder of reminders) {
      ReminderScheduler.cancelReminder(reminder.id);
    }

    // 2. Fetch all lots + their top bids in one query
    const winners = Database.getWinnersForAuction(auctionId);

    // 3. Edit each lot message to its ended state (no buttons, shows winner)
    for (const lotWinner of winners) {
      if (!lotWinner.message_id || !lotWinner.channel_id) continue;
      try {
        const channel = container.client.channels.cache.get(lotWinner.channel_id) ?? (await container.client.channels.fetch(lotWinner.channel_id));
        if (channel?.isTextBased()) {
          const message = await channel.messages.fetch(lotWinner.message_id);
          await message.edit({
            components: [AuctionLotEndedComponents({ lot: lotWinner })],
            flags: [MessageFlags.IsComponentsV2],
          });
        }
      } catch (err) {
        container.logger.error(`[AuctionEndScheduler] Failed to edit lot ${lotWinner.id} message:`, err);
      }
    }

    // 4. Group winning lots by winner and DM each winner (skip for test auctions)
    if (!isTest) {
      const byWinner = new Map<string, LotWinnerRow[]>();
      for (const lot of winners) {
        if (!lot.winner_user_id) continue;
        const existing = byWinner.get(lot.winner_user_id) ?? [];
        existing.push(lot);
        byWinner.set(lot.winner_user_id, existing);
      }
      for (const [userId, wonLots] of byWinner) {
        try {
          const user = await container.client.users.fetch(userId);
          await user.send({
            components: [WinnerDMMessageComponents(wonLots)],
            flags: [MessageFlags.IsComponentsV2],
          });
        } catch (err) {
          container.logger.error(`[AuctionEndScheduler] Failed to DM winner ${userId}:`, err);
        }
      }
    }

    // 5. Post a summary message in the auction channel
    const auction = Database.getAuction(auctionId);
    if (auction) {
      try {
        const channel = container.client.channels.cache.get(auction.channel_id) ?? (await container.client.channels.fetch(auction.channel_id));
        if (channel?.isSendable()) {
          await channel.send({
            content: `🏁 **The auction has ended!**${isTest ? ' *(test run — no DMs sent)*' : ''} Winners have been notified via DM.`,
          });
        }
      } catch (err) {
        container.logger.error(`[AuctionEndScheduler] Failed to post auction end summary:`, err);
      }
    }

    container.logger.info(`[AuctionEndScheduler] Auction end complete for ${auctionId}.`);
  }
}
