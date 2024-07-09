import type { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { GoogleSpreadsheetUtil } from './googleSpreadsheetUtil';
import { Collection } from 'discord.js';
import type { AhfGuildMemberSheetData } from '../types/ahfGuildMemberSheetData';
import numeral from 'numeral';

export class MemberSheetHelper {
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

  private async loadMemberList() {
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
  }

  private async loadTopSellers() {
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
