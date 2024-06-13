import { Collection } from 'discord.js';
import { MemberCacheManager } from '../utils/memberCacheManager';

export const AuctionEndDates = new Collection<string, Date>();
export const MemberCacheManagerInstance = new MemberCacheManager();
