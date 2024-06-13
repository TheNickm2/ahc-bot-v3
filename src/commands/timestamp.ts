import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { Constants } from '../config/constants';
import Sugar from 'sugar';
import { TimestampHelperEmbed } from '../utils/embedUtil';

@ApplyOptions<Command.Options>({
	description: 'Get Discord timestamp formats for a given date/time! Must use EASTERN TIME.',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.addStringOption((option) =>
						option.setName('input').setDescription('The date/time to convert to Discord timestamp formats. Must use EASTERN TIME.').setRequired(true),
					),
			{
				guildIds: Constants.DEFAULT_GUILD_IDS,
			},
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const input = interaction.options.getString('input', true);
		let date = Sugar.Date.create(input);
		let parseFailed = false;
		if (!Sugar.Date.isValid(date)) {
			parseFailed = true;
			date = new Date();
		}
		const embed = TimestampHelperEmbed(date);
		return interaction.reply({
			ephemeral: true,
			content: parseFailed ? '## Failed to parse date. Using current date/time instead.' : undefined,
			embeds: [embed],
		});
	}
}
