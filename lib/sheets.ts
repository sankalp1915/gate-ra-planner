import 'server-only';
import { JWT } from 'google-auth-library';

export class ConfigError extends Error {}

type Cell = string | number | boolean;
export type Row = Cell[];

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

let client: JWT | null = null;

function readCredentials(): { email: string; key: string } {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const raw = json.startsWith('{') ? json : Buffer.from(json, 'base64').toString('utf8');
    try {
      const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
      if (parsed.client_email && parsed.private_key) {
        return { email: parsed.client_email, key: parsed.private_key };
      }
    } catch {
      /* fall through to the error below */
    }
    throw new ConfigError('GOOGLE_SERVICE_ACCOUNT_JSON is set but is not a valid service-account key.');
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
  if (!email || !key) {
    throw new ConfigError(
      'Google credentials are missing. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT_JSON).',
    );
  }
  return { email, key };
}

function sheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID?.trim();
  if (!id) throw new ConfigError('GOOGLE_SHEET_ID is missing.');
  return id;
}

async function token(): Promise<string> {
  if (!client) {
    const { email, key } = readCredentials();
    client = new JWT({ email, key, scopes: SCOPES });
  }
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('Could not obtain a Google access token.');
  return token;
}

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${BASE}/${sheetId()}${path}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403 || res.status === 404) {
      throw new ConfigError(
        `Google Sheets returned ${res.status}. Share the sheet with the service-account email as Editor and check GOOGLE_SHEET_ID. (${text.slice(0, 200)})`,
      );
    }
    throw new Error(`Google Sheets API ${res.status}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

const enc = (range: string) => encodeURIComponent(range);

export interface SheetMeta {
  title: string;
  sheetId: number;
}

export async function getSheets(): Promise<SheetMeta[]> {
  const data = await api<{ sheets: { properties: SheetMeta }[] }>('?fields=sheets.properties(sheetId,title)');
  return data.sheets.map((s) => s.properties);
}

export async function batchGet(ranges: string[]): Promise<Row[][]> {
  const q = ranges.map((r) => `ranges=${enc(r)}`).join('&');
  const data = await api<{ valueRanges: { values?: Row[] }[] }>(
    `/values:batchGet?${q}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
  );
  return data.valueRanges.map((v) => v.values ?? []);
}

export async function getColumn(range: string): Promise<string[]> {
  const [rows] = await batchGet([range]);
  return rows.map((r) => String(r[0] ?? ''));
}

export async function update(range: string, values: Row[]): Promise<void> {
  await api(`/values/${enc(range)}?valueInputOption=RAW`, { method: 'PUT', body: { range, values } });
}

export async function append(range: string, values: Row[]): Promise<void> {
  await api(`/values/${enc(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: { values },
  });
}

export async function clear(range: string): Promise<void> {
  await api(`/values/${enc(range)}:clear`, { method: 'POST', body: {} });
}

export async function batchUpdate(requests: unknown[]): Promise<void> {
  await api(':batchUpdate', { method: 'POST', body: { requests } });
}

/** Deletes one sheet row. `row` is the 1-based row number as shown in Google Sheets. */
export async function deleteRow(tab: string, row: number): Promise<void> {
  const meta = (await getSheets()).find((s) => s.title === tab);
  if (!meta) throw new Error(`Tab ${tab} not found`);
  await batchUpdate([
    {
      deleteDimension: {
        range: { sheetId: meta.sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row },
      },
    },
  ]);
}
