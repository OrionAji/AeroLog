export interface SpreadsheetTabInfo {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  tabs: SpreadsheetTabInfo[];
}

async function handleSheetsResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Google Sheets request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // ignore non-json error body
    }
    if (res.status === 401) {
      throw new Error('Google session expired. Please sign in with Google again.');
    }
    if (res.status === 403) {
      throw new Error('Permission denied. Make sure you have access to this Google Sheet.');
    }
    if (res.status === 404) {
      throw new Error('Spreadsheet not found. Double-check the Google Sheets URL or ID.');
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

function escapeSheetRangeName(sheetName: string): string {
  const escaped = sheetName.replace(/'/g, "''");
  return `'${escaped}'`;
}

export async function fetchSpreadsheetMetadata(
  spreadsheetId: string,
  accessToken: string
): Promise<SpreadsheetMetadata> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title,gridProperties)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await handleSheetsResponse<{
    spreadsheetId: string;
    properties?: { title?: string };
    sheets?: Array<{
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  }>(res);

  const tabs: SpreadsheetTabInfo[] = (data.sheets ?? []).map((s, idx) => ({
    sheetId: s.properties?.sheetId ?? idx,
    title: s.properties?.title ?? `Sheet ${idx + 1}`,
    rowCount: s.properties?.gridProperties?.rowCount ?? 0,
    columnCount: s.properties?.gridProperties?.columnCount ?? 0,
  }));

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title ?? 'Untitled Spreadsheet',
    tabs,
  };
}

export async function fetchSheetValues(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<string[][]> {
  const range = `${escapeSheetRangeName(sheetName)}!A1:AZ2000`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await handleSheetsResponse<{ values?: string[][] }>(res);
  return data.values ?? [];
}

export async function appendSheetRows(
  spreadsheetId: string,
  sheetName: string,
  rows: (string | number)[][],
  accessToken: string
): Promise<{ updatedRange?: string; updatedRows?: number }> {
  const range = `${escapeSheetRangeName(sheetName)}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: rows }),
  });

  const data = await handleSheetsResponse<{
    updates?: { updatedRange?: string; updatedRows?: number };
  }>(res);
  return data.updates ?? {};
}

export async function updateSheetRow(
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  rowValues: (string | number)[],
  accessToken: string
): Promise<void> {
  const range = `${escapeSheetRangeName(sheetName)}!A${rowNumber}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [rowValues] }),
  });

  await handleSheetsResponse(res);
}

export async function overwriteSheetValues(
  spreadsheetId: string,
  sheetName: string,
  allRows: (string | number)[][],
  accessToken: string
): Promise<void> {
  const clearRange = `${escapeSheetRangeName(sheetName)}!A1:AZ2000`;
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(clearRange)}:clear`;

  const clearRes = await fetch(clearUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await handleSheetsResponse(clearRes);

  const writeRange = `${escapeSheetRangeName(sheetName)}!A1`;
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`;

  const writeRes = await fetch(writeUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: allRows }),
  });
  await handleSheetsResponse(writeRes);
}

export async function createLogbookSpreadsheet(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  accessToken: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; sheetName: string }> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: 'Flight Logbook' } }],
    }),
  });

  const created = await handleSheetsResponse<{
    spreadsheetId: string;
    spreadsheetUrl: string;
  }>(createRes);

  const values = [headers, ...rows];
  await overwriteSheetValues(created.spreadsheetId, 'Flight Logbook', values, accessToken);

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
    sheetName: 'Flight Logbook',
  };
}
