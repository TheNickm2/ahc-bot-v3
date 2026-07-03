import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';
import { BidHistoryDMComponents } from '../utils/messageComponentUtil';

interface ParseResult {
  lotId: number;
}

const BID_HISTORY_MAX_ENTRIES = 75;

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction, { lotId }: ParseResult) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const lot = Database.getAuctionLot(lotId);
    if (!lot) {
      return interaction.editReply({ content: 'This lot could not be found.' });
    }

    const bids = Database.getBidHistoryForLot(lotId);
    const truncatedCount = Math.max(0, bids.length - BID_HISTORY_MAX_ENTRIES);
    const visibleBids = bids.slice(-BID_HISTORY_MAX_ENTRIES);

    const activeCount = bids.filter((bid) => bid.reverted_at == null).length;
    const revertedCount = bids.length - activeCount;

    const ledgerLines = visibleBids.map((bid) => {
      const amount = (bid.amount ?? 0).toLocaleString('en-us');
      const bidder = bid.user_id ? `<@${bid.user_id}>` : 'Unknown user';
      const status =
        bid.reverted_at != null
          ? ` — REVERTED by <@${bid.reverted_by}> at <t:${bid.reverted_at}:f>${bid.revert_reason ? ` (${bid.revert_reason})` : ''}`
          : '';
      return `\`${String(bid.id).padStart(4, '0')}\` • <t:${bid.created_at}:f> • ${bidder} • ${Constants.EMOTES.COIN} ${amount}${status}`;
    });

    const lotUrl =
      interaction.guildId && lot.channel_id && lot.message_id
        ? `https://discord.com/channels/${interaction.guildId}/${lot.channel_id}/${lot.message_id}`
        : undefined;

    const dmComponents = BidHistoryDMComponents({
      lot,
      ledgerLines,
      activeCount,
      revertedCount,
      lotUrl,
      truncatedCount,
    });

    try {
      const dmMessage = await interaction.user.send({
        components: [dmComponents],
        flags: [MessageFlags.IsComponentsV2],
      });
      const dmLink = `https://discord.com/channels/@me/${dmMessage.channel.id}/${dmMessage.id}`;
      return interaction.editReply({ content: `Check your DMs! 📬 [View message →](${dmLink})` });
    } catch {
      return interaction.editReply({
        content: 'I could not DM you. Please enable DMs and try again.',
      });
    }
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith(`${Constants.BUTTON_IDS.BID_HISTORY}:`)) return this.none();
    const lotId = parseInt(interaction.customId.slice(`${Constants.BUTTON_IDS.BID_HISTORY}:`.length), 10);
    if (Number.isNaN(lotId)) return this.none();
    return this.some({ lotId });
  }
}
