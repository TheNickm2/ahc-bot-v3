/* eslint-disable @typescript-eslint/no-unused-vars */

import { container } from "@sapphire/framework";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

/**
 * Google Spreadsheet Util Class.
 * This class is used to interact with Google Sheets API. Each individual sheet being interacted with should have its own instance of this class.
 *
 * @export
 * @class GoogleSpreadsheetUtil
 */
export class GoogleSpreadsheetUtil {
  // Google Auth Object
  private readonly GoogleAuth: JWT;
  // Flag to check if the document metadata is loaded
  private isInitialized = false;
  // Google Spreadsheet Object, public to allow direct interaction with the google-spreadsheet library as needed
  public readonly GoogleSpreadsheet: GoogleSpreadsheet;

  constructor(sheetId: string) {
    if (!sheetId) throw new Error("Sheet ID is required");
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      throw new Error(
        "Environment Configuration Error. Google Service Account Email is required",
      );
    }
    if (!process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error(
        "Environment Configuration Error. Google Private Key is required",
      );
    }
    this.GoogleAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.GoogleSpreadsheet = new GoogleSpreadsheet(sheetId, this.GoogleAuth);
  }

  /**
   * Internal function to initialize the document metadata.
   *
   * @private
   * @return {*}
   * @memberof GoogleSpreadsheetUtil
   */
  private async init() {
    if (this.isInitialized) return;
    await this.GoogleSpreadsheet.loadInfo();
    container.logger.debug(
      "Google Spreadsheet Metadata Loaded",
      this.GoogleSpreadsheet.title,
      this.GoogleSpreadsheet.spreadsheetId,
    );
    this.isInitialized = true;
  }

  /**
   * Get a sheet in the document by index or title. Defaults to the first sheet if no index or title is provided.
   *
   * @param {number} [sheetIndex=0]
   * @param {string} [sheetTitle]
   * @return {GoogleSpreadsheetWorksheet}
   * @memberof GoogleSpreadsheetUtil
   */
  public async getSheet(sheetIndex = 0, sheetTitle?: string) {
    if (!this.isInitialized) await this.init();
    if (sheetTitle) {
      return await this.GoogleSpreadsheet.sheetsByTitle[sheetTitle];
    }
    return this.GoogleSpreadsheet.sheetsByIndex[sheetIndex];
  }
}
