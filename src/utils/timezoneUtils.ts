import { SlashCommandStringOption } from 'discord.js';

export function getTimezoneOffsetMinutes(ianaName: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ianaName, timeZoneName: 'shortOffset' }).formatToParts(new Date());
  const offsetStr = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';
  const match = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 0;
  return (match[1] === '+' ? 1 : -1) * (parseInt(match[2], 10) * 60 + parseInt(match[3] ?? '0', 10));
}

export function getTimezoneStringOption() {
  return new SlashCommandStringOption()
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
    );
}
