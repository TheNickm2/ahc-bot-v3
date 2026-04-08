import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { Constants } from '../config/constants';
import * as chrono from 'chrono-node';
import { MessageFlags, TextDisplayBuilder } from 'discord.js';
import { getTimezoneOffsetMinutes, getTimezoneStringOption } from '../utils/timezoneUtils';
import { TimestampHelperMessageComponents } from '../utils/messageComponentUtil';

@ApplyOptions<Command.Options>({
  description: 'Get Discord timestamp formats for a given date/time! Default TZ US East.',
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((option) =>
            option.setName('input').setDescription('The date/time to convert to Discord timestamp formats. Default TZ US East.').setRequired(true),
          )
          .addStringOption(getTimezoneStringOption()),
      {
        guildIds: Constants.DEFAULT_GUILD_IDS,
      },
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const input = interaction.options.getString('input', true);
    const timezone = interaction.options.getString('timezone') || 'America/New_York';
    const tzOffsetMinutes = getTimezoneOffsetMinutes(timezone);
    const parsed = chrono.parseDate(input, { instant: new Date(), timezone: tzOffsetMinutes });
    const parseFailed = parsed === null;
    const date = parsed ?? new Date();
    return interaction.reply({
      components: parseFailed
        ? [new TextDisplayBuilder().setContent(`## Failed to parse date. Using current date/time instead.`), TimestampHelperMessageComponents(date)]
        : [TimestampHelperMessageComponents(date)],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    });
  }
}
