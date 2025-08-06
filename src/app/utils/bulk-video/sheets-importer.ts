import { google } from 'googleapis';
import { BulkVideoData } from '@/app/types/bulk-video';
import { ColumnMapping, parseData as parseCSVData } from './csv-parser';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  range?: string; // e.g., 'Sheet1!A:G'
  credentials?: any; // OAuth2 credentials
}

export class GoogleSheetsImporter {
  private sheets: any;

  constructor(private auth: any) {
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async importFromSheet(
    config: GoogleSheetsConfig,
    columnMapping: ColumnMapping
  ): Promise<{
    success: boolean;
    data?: BulkVideoData[];
    error?: string;
    warnings?: string[];
  }> {
    try {
      const range = config.range || 'A:Z'; // Default to all columns
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range,
      });

      const values = response.data.values;
      
      if (!values || values.length === 0) {
        return {
          success: false,
          error: 'No data found in the specified sheet',
        };
      }

      // Convert to the same format as CSV parser expects
      return parseCSVData(values, columnMapping);
    } catch (error) {
      return {
        success: false,
        error: `Failed to import from Google Sheets: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  static async createFromServiceAccount(credentials: any): Promise<GoogleSheetsImporter> {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    return new GoogleSheetsImporter(auth);
  }

  static async createFromOAuth2(tokens: any): Promise<GoogleSheetsImporter> {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(tokens);
    
    return new GoogleSheetsImporter(oauth2Client);
  }

  static extractSpreadsheetId(url: string): string | null {
    // Extract spreadsheet ID from Google Sheets URL
    // Format: https://docs.google.com/spreadsheets/d/{spreadsheetId}/edit
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  static validateSheetsUrl(url: string): boolean {
    return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/.test(url);
  }
}

