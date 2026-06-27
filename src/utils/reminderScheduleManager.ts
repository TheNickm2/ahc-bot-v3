import nodeSchedule from 'node-schedule';
import { Database } from '../state/state';
import { container } from '@sapphire/framework';
import { sendReminder } from './reminderSendUtil';

export class ReminderScheduleManager {
  constructor() {
    const reminders = Database.getAllPendingReminders();
    reminders.forEach((reminder) => {
      if (reminder.remind_at * 1000 < Date.now()) {
        // reminder time is in the past, skip scheduling and delete it
        Database.deleteReminder(reminder.id);
        console.warn(
          `Deleted past reminder with ID ${reminder.id} during scheduler initialization. This should theoretically never happen unless the bot was offline during the reminder time or a bug has affected the reminder scheduling.`,
        );
        return;
      }
      nodeSchedule.scheduleJob(`reminder-${reminder.id}`, new Date(reminder.remind_at * 1000), async () => {
        await this.executeReminder(reminder.id);
      });
    });
  }

  private async executeReminder(reminderId: number): Promise<void> {
    const reminder = Database.getReminder(reminderId);
    if (!reminder) {
      container.logger.warn(`[ReminderScheduler] Tried to execute reminder ${reminderId}, but it no longer exists in the database.`);
      return;
    }
    const delivered = await sendReminder(reminder);
    if (delivered) {
      Database.deleteReminder(reminderId);
      container.logger.debug(`Executed scheduled reminder with ID ${reminderId}. Reminder removed from database.`);
    } else {
      container.logger.error(
        `[ReminderScheduler] Failed to deliver reminder ${reminderId}. It will NOT be removed from the database and will be cleaned up on next bot restart.`,
      );
    }
  }

  public scheduleReminder(reminderId: number /* from database */) {
    const reminder = Database.getReminder(reminderId);
    const existingJob = nodeSchedule.scheduledJobs[`reminder-${reminderId}`];
    if (reminder && !existingJob) {
      const scheduledJob = nodeSchedule.scheduleJob(`reminder-${reminderId}`, new Date(reminder.remind_at * 1000), async () => {
        await this.executeReminder(reminderId);
      });
      return scheduledJob;
    } else if (existingJob) return existingJob;
    else {
      container.logger.warn(`Tried to schedule reminder with ID ${reminderId}, but it does not exist in the database.`);
    }
    return;
  }

  public cancelReminder(reminderId: number) {
    const job = nodeSchedule.scheduledJobs[`reminder-${reminderId}`];
    if (job) {
      job.cancel();
    }
    Database.deleteReminder(reminderId);
    container.logger.debug(`Cancelled and deleted reminder with ID ${reminderId}. Reminder removed from database.`);
  }
}
