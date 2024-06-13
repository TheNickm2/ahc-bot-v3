import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
	public async run(interaction: ButtonInteraction) {
		await interaction.reply({
			content: 'Hello from a button interaction handler!',
			// Let's make it so only the person who pressed the button can see this message!
			ephemeral: true,
		});
	}

	public override parse(interaction: ButtonInteraction) {
		if (interaction.customId !== Constants.BUTTON_IDS.CHECK_STATUS) return this.none();
		return this.some();
	}
}
