import type { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { container } from '@sapphire/framework';
import { GoogleSpreadsheetUtil } from './googleSpreadsheetUtil';
import { Collection } from 'discord.js';
import type { AhfGuildMemberSheetData } from '../types/ahfGuildMemberSheetData';
import numeral from 'numeral';

export class MemberSheetHelper {
  private static readonly RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_BASE_DELAY_MS = 1000;

  private readonly googleSpreadsheetUtil: GoogleSpreadsheetUtil;
  private memberSheet: GoogleSpreadsheetWorksheet | undefined;
  private duesSheet: GoogleSpreadsheetWorksheet | undefined;

  private memberList: Collection<string, AhfGuildMemberSheetData> = new Collection();
  private topSellers: Collection<string, number> = new Collection();

  constructor() {
    if (!process.env.MEMBER_LIST_SPREADSHEET_ID) {
      throw new Error('Environment Configuration Error. Member List Spreadsheet ID is required');
    }
    this.googleSpreadsheetUtil = new GoogleSpreadsheetUtil(process.env.MEMBER_LIST_SPREADSHEET_ID);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getHttpStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const maybeWithResponse = error as { response?: { status?: unknown } };
    const status = maybeWithResponse.response?.status;
    return typeof status === 'number' ? status : undefined;
  }

  private isRetryableGoogleError(error: unknown): boolean {
    const status = this.getHttpStatus(error);
    return status !== undefined && MemberSheetHelper.RETRYABLE_STATUS_CODES.has(status);
  }

  private async withGoogleRetry<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MemberSheetHelper.MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const retryable = this.isRetryableGoogleError(error);
        const hasAttemptsLeft = attempt < MemberSheetHelper.MAX_RETRIES;

        if (!retryable || !hasAttemptsLeft) {
          throw error;
        }

        const delayMs = MemberSheetHelper.RETRY_BASE_DELAY_MS * attempt;
        const status = this.getHttpStatus(error);
        container.logger.warn(
          `[MemberSheetHelper] ${operationName} failed with ${status}. Retrying in ${delayMs}ms (attempt ${attempt}/${MemberSheetHelper.MAX_RETRIES}).`,
        );
        await this.sleep(delayMs);
      }
    }

    throw lastError;
  }

  private async loadMemberList() {
    await this.withGoogleRetry('loadMemberList', async () => {
      this.memberSheet = await this.googleSpreadsheetUtil.getSheet({
        title: 'AHC Bot Pull',
      });
      await this.memberSheet.loadCells('A2:F502');
      const rows = await this.memberSheet.getRows();
      rows.forEach((row) => {
        const who = row.get('Who')?.toLowerCase().trim();
        const rowData: AhfGuildMemberSheetData = {
          Who: row.get('Who'),
          Sales: numeral(row.get('Sales')).value() || 0,
          Safe: row.get('Safe') === 'TRUE',
          'Mat Raffle Tickets': numeral(row.get('Mat Raffle Tickets')).value() || 0,
        };
        this.memberList.set(who, rowData);
      });
    });
  }

  private async loadTopSellers() {
    await this.withGoogleRetry('loadTopSellers', async () => {
      this.duesSheet = await this.googleSpreadsheetUtil.getSheet({
        title: 'Dues',
      });
      await this.duesSheet.loadCells('AA26:AB35');
      for (let i = 26; i < 36; i++) {
        const sellerName = this.duesSheet.getCellByA1(`AA${i}`)?.value?.toString();
        const sellerAmount = Number(this.duesSheet.getCellByA1(`AB${i}`)?.value);
        if (typeof sellerAmount === 'number' && sellerName) {
          this.topSellers.set(sellerName.toLowerCase(), sellerAmount);
        }
      }
    });
  }

  public async getMemberList() {
    await this.loadMemberList();
    return this.memberList;
  }

  public async getTopSellers() {
    await this.loadTopSellers();
    return this.topSellers;
  }
}
