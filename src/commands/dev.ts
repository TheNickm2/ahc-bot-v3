import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { MemberCacheManagerInstance } from '../state/state';
import { Constants } from '../config/constants';

@ApplyOptions<Command.Options>({
	description: 'Info for development purposes',
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
		const responseMessage = await interaction.reply({
			content: 'Pinging API...',
			fetchReply: true,
			ephemeral: true,
		});
		const latency = interaction.client.ws.ping;
		const apiLatency = responseMessage.createdTimestamp - interaction.createdTimestamp;
		const cacheUpdated = MemberCacheManagerInstance.lastUpdated;
		return interaction.editReply({
			content: `**WebSocket Latency**: ${latency !== -1 ? `${latency}ms` : 'Not Yet Computed'}\n**API Latency**: ${apiLatency}ms\n**Google Sheets Cache Updated:**: <t:${Math.round(cacheUpdated.getTime() / 1000)}:f>`,
		});
	}
}
