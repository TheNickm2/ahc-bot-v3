import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { AuctionEndDates } from '../state/state';
import Sugar from 'sugar';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
	public async run(interaction: ButtonInteraction) {
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

		await interaction.reply({
			content: 'Hello from a button interaction handler!',
			ephemeral: true,
		});
	}

	public override parse(interaction: ButtonInteraction) {
		if (interaction.customId !== Constants.START_AUCTION_BUTTON_ID) return this.none();
		return this.some();
	}
}
