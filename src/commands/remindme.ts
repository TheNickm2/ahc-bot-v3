import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { MessageFlags, TextDisplayBuilder } from 'discord.js';
import Sugar from 'sugar';

@ApplyOptions<Command.Options>({
  description: 'A basic slash command',
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
        .addStringOption((option) =>
          option
            .setName('timezone')
            .setDescription('Time zone to interpret the reminder time in - defaults to US Eastern if not provided')
            .addChoices(
              // Americas (11)
              { name: 'US Eastern — New York, Miami (default)', value: 'America/New_York' },
              { name: 'US Central — Chicago, Dallas', value: 'America/Chicago' },
              { name: 'US Mountain — Denver, Salt Lake City', value: 'America/Denver' },
              { name: 'US Pacific — Los Angeles, Seattle', value: 'America/Los_Angeles' },
              { name: 'US Arizona — Phoenix (no DST)', value: 'America/Phoenix' },
              { name: 'US Alaska — Anchorage', value: 'America/Anchorage' },
              { name: 'US Hawaii — Honolulu', value: 'Pacific/Honolulu' },
              { name: 'Canada Atlantic — Halifax, Nova Scotia', value: 'America/Halifax' },
              { name: 'Mexico / Central America — Mexico City', value: 'America/Mexico_City' },
              { name: 'Brazil — São Paulo', value: 'America/Sao_Paulo' },
              { name: 'Argentina — Buenos Aires', value: 'America/Argentina/Buenos_Aires' },
              // Europe / UTC (6)
              { name: 'UTC — Universal Coordinated Time', value: 'Etc/UTC' },
              { name: 'UK & Ireland — London, Dublin', value: 'Europe/London' },
              { name: 'Central Europe — Paris, Berlin, Rome, Madrid', value: 'Europe/Paris' },
              { name: 'Eastern Europe — Helsinki, Athens, Bucharest', value: 'Europe/Helsinki' },
              { name: 'Russia — Moscow', value: 'Europe/Moscow' },
              { name: 'Turkey — Istanbul', value: 'Europe/Istanbul' },
              // Asia / Pacific (8)
              { name: 'Gulf — Dubai, Abu Dhabi, Riyadh', value: 'Asia/Dubai' },
              { name: 'India — Mumbai, New Delhi', value: 'Asia/Kolkata' },
              { name: 'Southeast Asia — Bangkok, Hanoi, Jakarta', value: 'Asia/Bangkok' },
              { name: 'Singapore / Malaysia — Singapore, Kuala Lumpur', value: 'Asia/Singapore' },
              { name: 'China — Shanghai, Beijing', value: 'Asia/Shanghai' },
              { name: 'Japan — Tokyo', value: 'Asia/Tokyo' },
              { name: 'South Korea — Seoul', value: 'Asia/Seoul' },
              { name: 'Australia Eastern — Sydney, Melbourne', value: 'Australia/Sydney' },
            ),
        ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const reminderMessage = interaction.options.getString('message', true).trim();
    const reminderTime = interaction.options.getString('time', true).trim();
    const reminderTimezone = interaction.options.getString('timezone') || 'America/New_York';
    if (!reminderMessage || !reminderTime) {
      return interaction.reply({
        components: [new TextDisplayBuilder().setContent('Please provide a reminder message and a date/time for the reminder.')],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      });
    }
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const tzOffset = new Intl.DateTimeFormat('en-US', {
      timeZone: reminderTimezone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')!
      .value.replace('GMT', '')
      .replace(/^([+-])(\d)$/, '$10$2:00')
      .replace(/^([+-]\d{2})$/, '$1:00');
    interaction.client.logger.debug(`Parsed timezone offset for ${reminderTimezone} as ${tzOffset} from Intl.DateTimeFormat.`);
    const parsedDate = Sugar.Date.create(`${reminderTime} ${tzOffset}`);
    if (!parsedDate || !Sugar.Date.isValid(parsedDate) || !Sugar.Date.isFuture(parsedDate)) {
      return interaction.editReply({
        components: [
          new TextDisplayBuilder().setContent(
            'The date/time you provided could not be parsed or is not in the future. Please provide a valid future date/time. Examples of valid formats include:\n- "in 2 hours"\n- "on Friday at 8pm"\n- "2026-01-01 4:00 PM"',
          ),
        ],
        flags: [MessageFlags.IsComponentsV2],
      });
    }
    // TODO: validate date input, schedule reminder and save to db, then reply with confirmation message
  }
}
