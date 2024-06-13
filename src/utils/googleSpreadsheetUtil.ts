/* eslint-disable @typescript-eslint/no-unused-vars */

import { container } from '@sapphire/framework';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

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
	// Google Spreadsheet Object, public to allow direct interaction with the google-spreadsheet library as needed
	public readonly GoogleSpreadsheet: GoogleSpreadsheet;

	constructor(sheetId: string) {
		if (!sheetId) throw new Error('Sheet ID is required');
		const serviceAccount = JSON.parse(atob(process.env.GOOGLE_SERVICE_ACCOUNT || '') || '{}');
		if (!serviceAccount.client_email || !serviceAccount.private_key) throw new Error('Google Service Account environment variable is required.');
		this.GoogleAuth = new JWT({
			email: serviceAccount.client_email,
			key: serviceAccount.private_key,
			keyId: serviceAccount.private_key_id || undefined,
			scopes: ['https://www.googleapis.com/auth/spreadsheets'],
		});
		this.GoogleSpreadsheet = new GoogleSpreadsheet(sheetId, this.GoogleAuth);
	}

	/**
	 * Internal function to load the document metadata.
	 *
	 * @private
	 * @return {*}
	 * @memberof GoogleSpreadsheetUtil
	 */
	private async loadDocumentMeta() {
		await this.GoogleSpreadsheet.loadInfo();
		container.logger.debug('Google Spreadsheet Metadata Loaded', this.GoogleSpreadsheet.title, this.GoogleSpreadsheet.spreadsheetId);
	}

	/**
	 * Get a sheet in the document by index or title. Defaults to the first sheet if no index or title is provided.
	 *
	 * @return {GoogleSpreadsheetWorksheet}
	 * @memberof GoogleSpreadsheetUtil
	 */
	public async getSheet(sheetInfo: { index?: number; title?: string }) {
		await this.loadDocumentMeta();
		if (sheetInfo?.title) {
			return await this.GoogleSpreadsheet.sheetsByTitle[sheetInfo.title];
		}
		return this.GoogleSpreadsheet.sheetsByIndex[sheetInfo?.index || 0];
	}
}
