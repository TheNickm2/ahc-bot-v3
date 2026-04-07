import nodeSchedule from 'node-schedule';
import { Database } from '../state/state';
import { container } from '@sapphire/framework';

export class ReminderScheduleManager {
  constructor() {
    const reminders = Database.getAllPendingReminders();
    reminders.forEach((reminder) => {
      if (reminder.remind_at * 1000 < Date.now()) {
        // reminder time is in the past, skip scheduling and delete it
        Database.deleteReminder(reminder.id);
        container.logger.warn(
          `Deleted past reminder with ID ${reminder.id} during scheduler initialization. This should theoretically never happen unless the bot was offline during the reminder time or a bug has affected the reminder scheduling.`,
        );
        return;
      }
      nodeSchedule.scheduleJob(`reminder-${reminder.id}`, new Date(reminder.remind_at * 1000), async () => {
        // TODO: implement reminder sending utility / async handle discord stuff
        // assuming the discord portion was successful, delete the reminder from the database
        Database.deleteReminder(reminder.id);
        container.logger.debug(`Executed scheduled reminder with ID ${reminder.id}. Reminder removed from database.`);
      });
    });
  }

  public scheduleReminder(reminderId: number /* from database */) {
    const reminder = Database.getReminder(reminderId);
    const existingJob = nodeSchedule.scheduledJobs[`reminder-${reminderId}`];
    if (reminder && !existingJob) {
      const scheduledJob = nodeSchedule.scheduleJob(`reminder-${reminderId}`, new Date(reminder.remind_at * 1000), async () => {
        // TODO: implement reminder sending utility / async handle discord stuff
        // assuming the discord portion was successful, delete the reminder from the database
        Database.deleteReminder(reminderId);
        container.logger.debug(`Executed scheduled reminder with ID ${reminder.id}. Reminder removed from database.`);
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
