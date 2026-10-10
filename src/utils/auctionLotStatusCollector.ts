import type { SapphireClient } from '@sapphire/framework';
import type { Guild, MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';
import { updateAuctionSummaryMessage } from './auctionBidFlow';
import { AuctionLotEndedComponents } from './messageComponentUtil';

type AuctionLotStatus = 'paid' | 'sent';

export class AuctionLotStatusCollector {
  private readonly watchedLots = new Map<string, number>();
  private readonly updateQueues = new Map<number, Promise<void>>();
  private listening = false;

  public watchAuction(client: SapphireClient, auctionId: string): void {
    for (const lot of Database.getWinnersForAuction(auctionId)) {
      if (lot.channel_id && lot.message_id) {
        this.watchedLots.set(`${lot.channel_id}:${lot.message_id}`, lot.id);
      }
    }
    this.start(client);
  }

  public rehydrate(client: SapphireClient): void {
    for (const lot of Database.getCompletedAuctionWinners()) {
      this.watchedLots.set(`${lot.channel_id}:${lot.message_id}`, lot.id);
    }
    this.start(client);
  }

  private start(client: SapphireClient): void {
    if (this.listening) return;
    this.listening = true;
    if (!Constants.AUCTION_OFFICER_ROLE_ID) {
      client.logger.warn('[AuctionLotStatusCollector] AUCTION_OFFICER_ROLE_ID is not configured; lot status reactions are disabled.');
    }
    client.on('messageReactionAdd', (reaction, user) => {
      void this.handleReaction(client, reaction, user).catch((err) => {
        client.logger.error('[AuctionLotStatusCollector] Failed to process auction lot reaction:', err);
      });
    });
  }

  private async handleReaction(client: SapphireClient, reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
    const lotId = this.watchedLots.get(`${message.channelId}:${message.id}`);
    if (!lotId || !message.guild) return;

    const status = this.getStatus(reaction.emoji.name);
    if (!status || !(await this.isAuctionOfficer(message.guild, user.id))) return;

    await this.enqueueLotUpdate(lotId, async () => {
      Database.markAuctionLotStatus(lotId, status);
      const lot = Database.getWinnerForLot(lotId);
      if (!lot) return;

      await Promise.all([
        message.edit({
          components: [AuctionLotEndedComponents({ lot })],
          flags: [MessageFlags.IsComponentsV2],
        }),
        updateAuctionSummaryMessage(client, lot.auction_id, { isEnded: true }),
      ]);
    });
  }

  private getStatus(emojiName: string | null): AuctionLotStatus | undefined {
    if (emojiName === Constants.EMOTES.BANK) return 'paid';
    if (emojiName === Constants.EMOTES.MAIL) return 'sent';
    return undefined;
  }

  private async isAuctionOfficer(guild: Guild, userId: string): Promise<boolean> {
    const officerRoleId = Constants.AUCTION_OFFICER_ROLE_ID;
    if (!officerRoleId) {
      return false;
    }
    const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId));
    return member.roles.cache.has(officerRoleId);
  }

  private async enqueueLotUpdate(lotId: number, update: () => Promise<void>): Promise<void> {
    const previous = this.updateQueues.get(lotId) ?? Promise.resolve();
    const queuedUpdate = previous.catch(() => undefined).then(update);
    this.updateQueues.set(lotId, queuedUpdate);

    try {
      await queuedUpdate;
    } catch (err) {
      console.error(`[AuctionLotStatusCollector] Failed to update status for lot ${lotId}:`, err);
    } finally {
      if (this.updateQueues.get(lotId) === queuedUpdate) {
        this.updateQueues.delete(lotId);
      }
    }
  }
}
