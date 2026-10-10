import nodeSchedule from 'node-schedule';
import { container } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';
import { Database, ReminderScheduler } from '../state/state';
import { AuctionLotEndedComponents, OfficerAuctionRecapComponents, WinnerDMMessageComponents } from './messageComponentUtil';
import type { LotWinnerRow } from '../types/database';
import { Constants } from '../config/constants';
import { closeBidderUndoWindowsForAuction, updateAuctionSummaryMessage } from './auctionBidFlow';
import { AuctionLotStatusCollector } from './auctionLotStatusCollector';

export class AuctionEndScheduler {
  private readonly lotStatusCollector = new AuctionLotStatusCollector();

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

  public rehydrateLotStatusCollector(): void {
    this.lotStatusCollector.rehydrate(container.client);
  }

  private async executeAuctionEnd(auctionId: string, isTest: boolean): Promise<void> {
    container.logger.info(`[AuctionEndScheduler] Executing auction end for ${auctionId} (isTest: ${isTest}).`);

    // 1. Fetch all lots + their top bids in one query
    const winners = Database.getWinnersForAuction(auctionId);

    // 2. Edit each lot message to its ended state (no bidding buttons, shows winner), 3. close any
    // still-open self-serve user undo windows, and 5. update the auction summary. These all touch
    // distinct messages/channels and are independent of one another, so run them concurrently.
    const lotEditsPromise = Promise.all(
      winners
        .filter((lotWinner) => lotWinner.message_id && lotWinner.channel_id)
        .map(async (lotWinner) => {
          try {
            const channel =
              container.client.channels.cache.get(lotWinner.channel_id!) ?? (await container.client.channels.fetch(lotWinner.channel_id!));
            if (channel?.isTextBased()) {
              const message = await channel.messages.fetch(lotWinner.message_id!);
              await message.edit({
                components: [AuctionLotEndedComponents({ lot: lotWinner })],
                flags: [MessageFlags.IsComponentsV2],
              });
            }
          } catch (err) {
            container.logger.error(`[AuctionEndScheduler] Failed to edit lot ${lotWinner.id} message:`, err);
          }
        }),
    );
    const closeUndoWindowsPromise = closeBidderUndoWindowsForAuction(container.client, auctionId);
    const summaryPromise = updateAuctionSummaryMessage(container.client, auctionId, { isEnded: true });

    // 4. Cancel any pending reminder jobs for this auction (they're no longer relevant)
    const reminders = Database.getAuctionReminders(auctionId);
    for (const reminder of reminders) {
      ReminderScheduler.cancelReminder(reminder.id);
    }

    // 6. Group winning lots by winner and DM each winner (skip for test auctions). Independent of
    // the message edits above, so it runs concurrently with them rather than after.
    const dmResults = new Map<string, boolean>();
    let dmPromise: Promise<unknown> = Promise.resolve();
    if (!isTest) {
      const byWinner = new Map<string, LotWinnerRow[]>();
      for (const lot of winners) {
        if (!lot.winner_user_id) continue;
        const existing = byWinner.get(lot.winner_user_id) ?? [];
        existing.push(lot);
        byWinner.set(lot.winner_user_id, existing);
      }
      dmPromise = Promise.all(
        [...byWinner].map(async ([userId, wonLots]) => {
          try {
            const user = await container.client.users.fetch(userId);
            await user.send({
              components: [WinnerDMMessageComponents(wonLots)],
              flags: [MessageFlags.IsComponentsV2],
            });
            dmResults.set(userId, true);
          } catch (err) {
            dmResults.set(userId, false);
            container.logger.error(`[AuctionEndScheduler] Failed to DM winner ${userId}:`, err);
          }
        }),
      );
    }

    await Promise.all([lotEditsPromise, closeUndoWindowsPromise, summaryPromise]);
    this.lotStatusCollector.watchAuction(container.client, auctionId);
    await dmPromise;

    // 7. Post a summary message in the auction channel, and 8. the officer recap to the log
    // channel. The recap depends on dmResults (from step 6, awaited above) but the two posts are
    // otherwise independent of each other.
    const auction = Database.getAuction(auctionId);
    if (auction) {
      const announcementPromise = (async () => {
        try {
          const channel = container.client.channels.cache.get(auction.channel_id) ?? (await container.client.channels.fetch(auction.channel_id));
          if (channel?.isSendable()) {
            await channel.send({
              content: `**The auction has ended!**${isTest ? ' *(test run — no DMs sent)*' : ''} Winners have been notified via DM.`,
            });
          }
        } catch (err) {
          container.logger.error(`[AuctionEndScheduler] Failed to post auction end summary:`, err);
        }
      })();

      const logChannelId = Constants.AUCTION_LOG_CHANNEL_ID;
      const recapPromise = logChannelId
        ? (async () => {
            try {
              const logChannel = container.client.channels.cache.get(logChannelId) ?? (await container.client.channels.fetch(logChannelId));
              if (logChannel?.isSendable()) {
                await logChannel.send({
                  components: [OfficerAuctionRecapComponents({ winners, dmResults, isTest, auctionEndTime: auction.end_time })],
                  flags: [MessageFlags.IsComponentsV2],
                });
              }
            } catch (err) {
              container.logger.error(`[AuctionEndScheduler] Failed to post officer recap to log channel:`, err);
            }
          })()
        : Promise.resolve();

      await Promise.all([announcementPromise, recapPromise]);
    }

    container.logger.info(`[AuctionEndScheduler] Auction end complete for ${auctionId}.`);
  }
}
