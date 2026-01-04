import { Collection } from 'discord.js';
import { MemberCacheManager } from '../utils/memberCacheManager';
import { DatabaseManager } from '../utils/databaseManager';
import { ReminderScheduler } from '../utils/reminderScheduler';

export const AuctionEndDates = new Collection<string, Date>();
export const MemberCacheManagerInstance = new MemberCacheManager();
export const Database = new DatabaseManager();
export const ReminderScheduleManager = new ReminderScheduler();
