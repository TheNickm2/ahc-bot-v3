import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { MessageFlags, TextDisplayBuilder } from 'discord.js';
import * as chrono from 'chrono-node';
import { getTimezoneOffsetMinutes, getTimezoneStringOption } from '../utils/timezoneUtils';
import { Database, ReminderScheduler } from '../state/state';

@ApplyOptions<Command.Options>({
  description:
    'Set a reminder for yourself. You can specify the time in a natural language format (e.g. "in 4 hours", "on Friday at 8pm", or "2026-01-01 4:00 PM") and an optional timezone (default is US Eastern).',
  enabled: false,
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder //
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) => option.setName('message').setDescription('The message to include in your reminder').setRequired(true))
        .addStringOption((option) =>
          option.setName('time').setDescription('When to remind you (e.g. in 4 hours, on Friday at 8pm, or 2026-01-01 4:00 PM').setRequired(true),
        )
        .addStringOption(getTimezoneStringOption()),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const reminderMessage = interaction.options.getString('message', true).trim();
    const reminderTime = interaction.options.getString('time', true).trim();
    const reminderTimezone = interaction.options.getString('timezone') || 'America/New_York';
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const tzOffsetMinutes = getTimezoneOffsetMinutes(reminderTimezone);
    interaction.client.logger.debug(`Parsed timezone offset for ${reminderTimezone} as ${tzOffsetMinutes} minutes from UTC.`);
    const parsedDate = chrono.parseDate(reminderTime, { instant: new Date(), timezone: tzOffsetMinutes });
    if (!parsedDate || parsedDate <= new Date()) {
      return interaction.editReply({
        components: [
          new TextDisplayBuilder().setContent(
            'The date/time you provided could not be parsed or is not in the future. Please provide a valid future date/time. Examples of valid formats include:\n- "in 2 hours"\n- "on Friday at 8pm"\n- "2026-01-01 4:00 PM"',
          ),
        ],
        flags: [MessageFlags.IsComponentsV2],
      });
    }
    const remindAt = Math.floor(parsedDate.getTime() / 1000);
    const result = Database.insertReminder({
      user_id: interaction.user.id,
      channel_id: interaction.channelId,
      message: reminderMessage,
      remind_at: remindAt,
    });
    const newReminderId = Number(result.lastInsertRowid);
    ReminderScheduler.scheduleReminder(newReminderId);
    interaction.client.logger.debug(`Scheduled reminder with ID ${newReminderId} for <@${interaction.user.id}> at <t:${remindAt}:F>.`);
    return interaction.editReply({
      components: [
        new TextDisplayBuilder().setContent(`Got it! I'll remind you <t:${remindAt}:R> (on <t:${remindAt}:f>).\n\n**Reminder:** ${reminderMessage}`),
      ],
      flags: [MessageFlags.IsComponentsV2],
    });
  }
}
