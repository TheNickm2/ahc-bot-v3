import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { Collection, MessageFlags, TextDisplayBuilder, type ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { AuctionEndDates, Database } from '../state/state';
import { AuctionLotHelper } from '../utils/auctionLotHelper';
import type { AuctionLot } from '../types/auction';
import { AuctionLotMessageComponents, AuctionSummaryMessageComponents, TimestampHelperMessageComponents } from '../utils/messageComponentUtil';

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
        flags: [MessageFlags.Ephemeral],
        content: 'An error has occurred. Please try again. If the issue persists, contact Nick. Error: Previous Interaction ID not found.',
      });
    }
    const auctionState = AuctionEndDates.get(previousInteractionId);
    if (!auctionState) {
      interaction.client.logger.error('End date not found. Start Auction interaction failed.');
      return interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: 'An error has occurred. Please try again. If the issue persists, contact Nick. Error: End date not found.',
      });
    }
    const { endDate, isTest } = auctionState;
    if (endDate <= new Date()) {
      interaction.client.logger.error('End date is not in the future. Start Auction interaction failed.');
      return interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: 'A valid date in the future must be provided. Please try again.',
      });
    }

    // Clean up any existing active auction before starting a new one.
    // This handles the case where an officer deletes lot messages and re-runs the command to fix a typo.
    const existingAuction = Database.getActiveAuction();
    if (existingAuction) {
      // TODO Phase 5: AuctionEndScheduler.cancelAuctionEnd(existingAuction.id)
      Database.deleteAuction(existingAuction.id);
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const auctionLotHelper = new AuctionLotHelper();
    const auctionLots = await auctionLotHelper.getAuctionLots();
    if (!auctionLots || !auctionLots.length) {
      return interaction.editReply({
        content: 'No auction lots were found when querying Google Sheets. If you believe this is an error, please contact Nick!',
      });
    }

    const auctionId = previousInteractionId;
    Database.insertAuction({
      id: auctionId,
      end_time: Math.floor(endDate.getTime() / 1000),
      channel_id: interaction.channelId,
      is_test: isTest ? 1 : 0,
    });

    const auctionLotMessages = new Collection<string, AuctionLot & { lotId: number }>();
    for (let i = 0; i < auctionLots.length; i++) {
      const lot = auctionLots[i];
      const lotNumber = i + 1;
      const lotId = Database.insertAuctionLot({
        auction_id: auctionId,
        message_id: null,
        channel_id: interaction.channelId,
        lot_number: lotNumber,
        title: lot.title,
        starting_bid: lot.startingBid,
      });
      const message = await interaction.channel.send({
        components: [AuctionLotMessageComponents({ lotInfo: lot, lotNumber, lotId })],
        flags: [MessageFlags.IsComponentsV2],
      });
      if (!message) continue;
      Database.updateAuctionLotMessageId(lotId, message.id);
      auctionLotMessages.set(message.id, { ...lot, lotId });
    }

    const summaryComponents = AuctionSummaryMessageComponents({
      auctionLots: auctionLotMessages.map((lot, messageId) => ({ ...lot, messageId })),
      endDate,
      channel: interaction.channel,
      auctionId,
      isTest,
    });
    await interaction.channel.send({
      components: [summaryComponents],
      flags: [MessageFlags.IsComponentsV2],
    });

    // TODO Phase 5: AuctionEndScheduler.scheduleAuctionEnd(auctionId, endDate, isTest)

    await interaction.deleteReply();
    const summaryComponent = new TextDisplayBuilder().setContent(
      `Auction lots posted successfully ${Constants.EMOTES.CHECK}\nThe timestamp helper below may be used to format your announcement message!`,
    );
    return await interaction.followUp({
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      components: [summaryComponent, TimestampHelperMessageComponents(endDate)],
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (interaction.customId !== Constants.BUTTON_IDS.START_AUCTION) return this.none();
    return this.some();
  }
}
