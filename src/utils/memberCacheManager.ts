import type { Collection } from 'discord.js';
import type { AhfGuildMemberSheetData } from '../types/ahfGuildMemberSheetData';
import { MemberSheetHelper } from './memberSheetHelper';
import schedule from 'node-schedule';

export class MemberCacheManager {
  private readonly memberSheetHelper: MemberSheetHelper;
  private cachedMembersList: Collection<string, AhfGuildMemberSheetData> | undefined;
  private cachedTopSellers: Collection<string, number> | undefined;
  private isInitialized = false;
  private cronJob: schedule.Job | null = null;
  public lastUpdated: Date;

  constructor() {
    this.memberSheetHelper = new MemberSheetHelper();
    this.initialize();
    this.lastUpdated = new Date();
  }
  private async initialize() {
    const job = schedule.scheduleJob('0 0 * * * *', async () => {
      this.cachedMembersList = await this.memberSheetHelper.getMemberList();
      this.cachedTopSellers = await this.memberSheetHelper.getTopSellers();
      this.lastUpdated = new Date();
    });
    job.invoke();
    this.cronJob = job;
    this.isInitialized = true;
  }
  public async getMemberList() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.cachedMembersList;
  }
  public async getTopSellers() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.cachedTopSellers;
  }
  public async refreshCache() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.cronJob?.invoke();
  }
}
