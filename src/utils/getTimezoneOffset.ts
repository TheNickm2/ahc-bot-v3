export function getTimezoneOffsetMinutes(ianaName: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ianaName, timeZoneName: 'shortOffset' }).formatToParts(new Date());
  const offsetStr = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';
  const match = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 0;
  return (match[1] === '+' ? 1 : -1) * (parseInt(match[2], 10) * 60 + parseInt(match[3] ?? '0', 10));
}
