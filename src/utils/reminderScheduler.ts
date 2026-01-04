import nodeSchedule from 'node-schedule';
import { Database } from '../state/state';
// import { container } from '@sapphire/framework';

export class ReminderScheduler {
  constructor() {
    const reminders = Database.getAllPendingReminders();
    reminders.forEach((reminder) => {
      if (reminder.remind_at * 1000 < Date.now()) {
        // reminder time is in the past, skip scheduling and delete it
        Database.deleteReminder(reminder.id);
        return;
      }
      nodeSchedule.scheduleJob(`reminder-${reminder.id}`, new Date(reminder.remind_at * 1000), () => {
        // TODO: implement reminder sending utility
        // assuming the discord portion was successful, delete the reminder from the database
        Database.deleteReminder(reminder.id);
      });
    });
  }

  public scheduleReminder(reminderId: number /* from database */) {
    const reminder = Database.getReminder(reminderId);
    if (reminder) {
      nodeSchedule.scheduleJob(`reminder-${reminderId}`, new Date(reminder.remind_at * 1000), () => {
        // TODO: implement reminder sending utility
        // assuming the discord portion was successful, delete the reminder from the database
        Database.deleteReminder(reminderId);
      });
      return nodeSchedule;
    }
    return;
  }

  public cancelReminder(reminderId: number) {
    const job = nodeSchedule.scheduledJobs[`reminder-${reminderId}`];
    if (job) {
      job.cancel();
    }
    Database.deleteReminder(reminderId);
  }
}
