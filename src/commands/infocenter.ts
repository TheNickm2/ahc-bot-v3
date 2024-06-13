import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { Constants } from '../config/constants';
import { InfoCenterEmbed } from '../utils/embedUtil';

@ApplyOptions<Command.Options>({
	description: 'View data from the AHC Info Center within Discord!',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description),
			{
				guildIds: Constants.DEFAULT_GUILD_IDS,
			},
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.reply({
			ephemeral: true,
			embeds: [InfoCenterEmbed()],
		});
	}
}
