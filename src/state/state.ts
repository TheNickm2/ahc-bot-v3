import { Collection } from 'discord.js';
import { MemberCacheManager } from '../utils/memberCacheManager';
import { DatabaseManager } from '../utils/databaseManager';
import { ReminderScheduleManager } from '../utils/reminderScheduleManager';

export const AuctionEndDates = new Collection<string, Date>();
export const MemberCacheManagerInstance = new MemberCacheManager();
export const Database = new DatabaseManager();
export const ReminderScheduler = new ReminderScheduleManager();
