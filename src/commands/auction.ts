import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { Constants } from '../config/constants';
import Sugar from 'sugar';
import { AuctionEndDates } from '../state/state';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'Officers Only - Post the Discord Auction',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.addStringOption((option) =>
						option
							.setName('end')
							.setRequired(true)
							.setDescription('The end of the auction - i.e. "Next Thursday at 8PM" - All times must be in Eastern Time'),
					),
			{
				guildIds: Constants.DEFAULT_GUILD_IDS,
			},
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const endDateString = interaction.options.getString('end', true);
		const endDate = Sugar.Date.create(endDateString);
		if (!endDateString || !Sugar.Date.isFuture(endDate)) {
			return interaction.reply({
				ephemeral: true,
				content: 'A valid date in the future must be provided. Please try again.',
			});
		}
		AuctionEndDates.set(interaction.id, endDate);
		const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId(Constants.START_AUCTION_BUTTON_ID).setLabel('Start').setStyle(ButtonStyle.Success),
		);
		return interaction.reply({
			ephemeral: true,
			content: `Auction end date set to <t:${Math.round(endDate.getTime() / 1000)}:F>. If this is correct, use the button below to post the auction. If not, use the command again to set a new date.`,
			components: [actionRow],
		});
	}
}
