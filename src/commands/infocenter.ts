import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { Constants } from '../config/constants';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { InfoCenterMessageComponents } from '../utils/messageComponentUtil';

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
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(Constants.BUTTON_IDS.TOP_SELLERS)
        .setLabel('Top Sellers')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(Constants.EMOTES.COIN),
      new ButtonBuilder()
        .setCustomId(Constants.BUTTON_IDS.CHECK_STATUS)
        .setLabel('Check My Status')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(Constants.EMOTES.INFO),
      new ButtonBuilder()
        .setCustomId(Constants.BUTTON_IDS.SERVER_BOOSTERS)
        .setLabel('Server Boosters')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(Constants.EMOTES.SERVER_BOOST),
    );
    await interaction.reply({
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      components: [InfoCenterMessageComponents(), buttonRow],
    });
  }
}
