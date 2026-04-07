import { container } from '@sapphire/framework';
import type { ReminderRow } from '../types/database';
import { ReminderEmbed } from './embedUtil';
import type { GuildTextBasedChannel } from 'discord.js';

/**
 * Sends a reminder notification to the channel where the reminder was originally created,
 * mentioning the user. Falls back to a DM if the channel is unreachable (e.g. deleted,
 * or the bot no longer has access).
 *
 * @returns `true` if the reminder was delivered successfully, `false` otherwise.
 */
export async function sendReminder(reminder: ReminderRow): Promise<boolean> {
  const embed = ReminderEmbed(reminder);

  // Primary: send to the original channel with a user mention
  try {
    const channel = (await container.client.channels.fetch(reminder.channel_id)) as GuildTextBasedChannel | null;
    if (channel?.isTextBased()) {
      await channel.send({ content: `<@${reminder.user_id}>`, embeds: [embed] });
      return true;
    }
  } catch (err) {
    container.logger.warn(
      `[ReminderSend] Could not deliver reminder ${reminder.id} to channel ${reminder.channel_id}. Falling back to DM. Error: ${err}`,
    );
  }

  // Fallback: DM the user directly
  try {
    const user = await container.client.users.fetch(reminder.user_id);
    await user.send({
      content: `*(I couldn't reach the original channel, so here's your reminder via DM)*`,
      embeds: [embed],
    });
    return true;
  } catch (err) {
    container.logger.error(`[ReminderSend] Could not deliver reminder ${reminder.id} to user ${reminder.user_id} via DM. Error: ${err}`);
    return false;
  }
}
