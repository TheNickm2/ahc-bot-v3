import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { Constants } from '../config/constants';
import * as chrono from 'chrono-node';
import { AuctionEndDates } from '../state/state';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { getTimezoneOffsetMinutes, getTimezoneStringOption } from '../utils/timezoneUtils';

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
            option.setName('end').setRequired(true).setDescription('The end of the auction - i.e. "Next Thursday at 8PM" - Default TZ US Eastern'),
          )
          .addStringOption(getTimezoneStringOption())
          .addBooleanOption((option) =>
            option.setName('is-test').setDescription('If true, winners will not receive DMs and the auction is treated as a test run'),
          ),
      {
        guildIds: Constants.DEFAULT_GUILD_IDS,
      },
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    if (!interaction.inGuild()) return;
    const endDateString = interaction.options.getString('end', true);
    const endDateTimezone = interaction.options.getString('timezone') || 'America/New_York';
    const tzOffsetMinutes = getTimezoneOffsetMinutes(endDateTimezone);
    const endDate = chrono.parseDate(endDateString, { instant: new Date(), timezone: tzOffsetMinutes });
    if (!endDate || endDate <= new Date()) {
      return interaction.reply({
        content: 'A valid date in the future must be provided. Please try again.',
        flags: [MessageFlags.Ephemeral],
      });
    }
    AuctionEndDates.set(interaction.id, { endDate, isTest: interaction.options.getBoolean('is-test') ?? false });
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(Constants.BUTTON_IDS.START_AUCTION).setLabel('Start').setStyle(ButtonStyle.Success),
    );
    return interaction.reply({
      content: `Auction end date set to <t:${Math.round(endDate.getTime() / 1000)}:F>. If this is correct, use the button below to post the auction. If not, use the command again to set a new date.`,
      components: [actionRow],
      flags: [MessageFlags.Ephemeral],
    });
  }
}
