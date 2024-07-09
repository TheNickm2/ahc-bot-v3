import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { Collection, ThreadAutoArchiveDuration, type ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { AuctionEndDates } from '../state/state';
import Sugar from 'sugar';
import { AuctionLotHelper } from '../utils/auctionLotHelper';
import { AuctionLotEmbed, AuctionSummaryEmbed, TimestampHelperEmbed } from '../utils/embedUtil';
import type { AuctionLot } from '../types/auction';

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction) {
    if (!interaction.inGuild()) return;
    if (!interaction.channel) {
      await interaction.guild?.channels.fetch(interaction.channelId);
      if (!interaction.channel) return;
    }
    const previousInteractionId = interaction.message.interaction?.id;
    if (!previousInteractionId) {
      interaction.client.logger.error('Previous Interaction ID not found. Start Auction interaction failed.');
      return interaction.reply({
        ephemeral: true,
        content: 'An error has occurred. Please try again. If the issue persists, contact Nick. Error: Previous Interaction ID not found.',
      });
    }
    const endDate = AuctionEndDates.get(previousInteractionId);
    if (!endDate) {
      interaction.client.logger.error('End date not found. Start Auction interaction failed.');
      return interaction.reply({
        ephemeral: true,
        content: 'An error has occurred. Please try again. If the issue persists, contact Nick. Error: End date not found.',
      });
    }
    if (!Sugar.Date.isFuture(endDate)) {
      interaction.client.logger.error('End date is not in the future. Start Auction interaction failed.');
      return interaction.reply({
        ephemeral: true,
        content: 'A valid date in the future must be provided. Please try again.',
      });
    }
    await interaction.deferReply({ ephemeral: true });
    const auctionLotHelper = new AuctionLotHelper();
    const auctionLots = await auctionLotHelper.getAuctionLots();
    if (!auctionLots || !auctionLots.length) {
      return interaction.editReply({
        content: 'No auction lots were found when querying Google Sheets. If you believe this is an error, please contact Nick!',
      });
    }
    const auctionLotEmbeds = auctionLots.map((lot, index) => AuctionLotEmbed({ lotInfo: lot, lotNumber: index + 1 }));
    const auctionLotMessages = new Collection<string, AuctionLot>();
    for (const embed of auctionLotEmbeds) {
      const message = await interaction.channel.send({ embeds: [embed] });
      if (!message) continue;
      auctionLotMessages.set(message.id, auctionLots[auctionLotEmbeds.indexOf(embed)]);
      await message.startThread({
        name: embed.data.title || `Lot ${auctionLotEmbeds.indexOf(embed) + 1}: ${auctionLots[auctionLotEmbeds.indexOf(embed)].title}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays,
      });
    }
    const summaryEmbed = AuctionSummaryEmbed({
      auctionLots: auctionLotMessages.map((lot, messageId) => ({ ...lot, messageId })),
      endDate,
      channel: interaction.channel,
    });
    await interaction.channel.send({
      embeds: [summaryEmbed],
    });
    await interaction.deleteReply();
    return await interaction.followUp({
      ephemeral: true,
      content: `Auction lots posted successfully ${Constants.EMOTES.CHECK}\nThe timestamp helper below may be used to format your announcement message!`,
      embeds: [TimestampHelperEmbed(endDate)],
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (interaction.customId !== Constants.BUTTON_IDS.START_AUCTION) return this.none();
    return this.some();
  }
}
