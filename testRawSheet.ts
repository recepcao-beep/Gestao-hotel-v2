import { google } from 'googleapis';
import * as dotenv from 'dotenv';
dotenv.config();

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function run() {
  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Apartamentos_VILAGE_INN!A1:Z5',
  });
  console.log(JSON.stringify(res.data.values, null, 2));
}

run();
