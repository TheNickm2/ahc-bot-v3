import { Collection } from 'discord.js';
import { MemberCacheManager } from '../utils/memberCacheManager';
import { DatabaseManager } from '../utils/databaseManager';
import { ReminderScheduleManager } from '../utils/reminderScheduleManager';
import { AuctionEndScheduler as AuctionEndSchedulerClass } from '../utils/auctionEndScheduler';

export const AuctionEndDates = new Collection<string, { endDate: Date; isTest: boolean }>();
export const MemberCacheManagerInstance = new MemberCacheManager();
export const Database = new DatabaseManager();
export const ReminderScheduler = new ReminderScheduleManager();
export const AuctionEndScheduler = new AuctionEndSchedulerClass();
