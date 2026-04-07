import { container } from '@sapphire/framework';
import type { ReminderRow } from '../types/database';
import { ReminderEmbed } from './embedUtil';

/**
 * Sends a reminder notification to the user via DM. Falls back to a channel mention
 * if the user's DMs are closed or otherwise unreachable.
 *
 * @returns `true` if the reminder was delivered successfully, `false` otherwise.
 */
export async function sendReminder(reminder: ReminderRow): Promise<boolean> {
  const embed = ReminderEmbed(reminder);

  // Primary: DM the user directly
  try {
    const user = await container.client.users.fetch(reminder.user_id);
    await user.send({ embeds: [embed] });
    return true;
  } catch (err) {
    container.logger.warn(
      `[ReminderSend] Could not deliver reminder ${reminder.id} to user ${reminder.user_id} via DM. Falling back to channel. Error: ${err}`,
    );
  }

  // Fallback: send to the original channel with a user mention
  try {
    const channel = await container.client.channels.fetch(reminder.channel_id);
    if (channel?.isSendable()) {
      await channel.send({ content: `<@${reminder.user_id}>`, embeds: [embed] });
      return true;
    }
  } catch (err) {
    container.logger.error(`[ReminderSend] Could not deliver reminder ${reminder.id} to channel ${reminder.channel_id}. Error: ${err}`);
  }

  return false;
}
