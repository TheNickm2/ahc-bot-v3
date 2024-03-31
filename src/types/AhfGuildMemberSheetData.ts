import type { GoogleSpreadsheetRow } from "google-spreadsheet";

export interface AhfGuildMemberSheetData extends GoogleSpreadsheetRow {
  Who: string;
  Sales: number;
  Safe?: boolean;
  "Mat Raffle Tickets": number;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
