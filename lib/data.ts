import 'server-only';
import { cache } from 'react';
import { append, batchGet, batchUpdate, clear, ConfigError, deleteRow, getColumn, getSheets, update, type Row } from './sheets';
import { DEFAULT_SETTINGS, SEED_TOPICS } from './seed';
import { isISODate } from './dates';
import type { Log, LogType, Mock, Override, Settings, Store, Topic } from './types';

export const TABS = {
  Topics: ['id', 'section', 'subject', 'topic', 'track', 'est_hours', 'order', 'active', 'done_on', 'notes'],
  Logs: ['id', 'date', 'topic_id', 'hours', 'type', 'note', 'created_at'],
  Settings: ['key', 'value'],
  Overrides: ['date', 'hours', 'reason'],
  Mocks: ['id', 'date', 'name', 'score', 'max_marks', 'hours', 'notes'],
} as const;
type Tab = keyof typeof TABS;

const colLetter = (n: number) => String.fromCharCode(64 + n);
const fullRange = (tab: Tab) => `${tab}!A2:${colLetter(TABS[tab].length)}`;

/* ---------- settings <-> key/value rows ---------- */

const DOW_KEYS = ['hours_sun', 'hours_mon', 'hours_tue', 'hours_wed', 'hours_thu', 'hours_fri', 'hours_sat'];

function settingsToRows(s: Settings): Row[] {
  return [
    ['start_date', s.startDate],
    ['syllabus_end', s.syllabusEnd],
    ['revision_start', s.revisionStart],
    ['revision_end', s.revisionEnd],
    ['exam_date', s.examDate],
    ...DOW_KEYS.map((k, i) => [k, s.hours[i]] as Row),
    ['redistribution', s.mode],
    ['math_share', s.mathShare],
    ['revision_load', s.revisionLoad],
    ['mock_hours', s.mockHours],
  ];
}

function rowsToSettings(rows: Row[]): Settings {
  const kv = new Map(rows.map((r) => [String(r[0] ?? ''), r[1]]));
  const d = DEFAULT_SETTINGS;
  const date = (k: string, fb: string) => (isISODate(String(kv.get(k) ?? '')) ? String(kv.get(k)) : fb);
  const num = (k: string, fb: number, min = 0, max = 24) => {
    const v = Number(kv.get(k));
    return Number.isFinite(v) && kv.get(k) !== '' && kv.get(k) !== undefined ? Math.min(Math.max(v, min), max) : fb;
  };
  const ms = kv.get('math_share');
  const msNum = Number(ms);
  return {
    startDate: date('start_date', d.startDate),
    syllabusEnd: date('syllabus_end', d.syllabusEnd),
    revisionStart: date('revision_start', d.revisionStart),
    revisionEnd: date('revision_end', d.revisionEnd),
    examDate: date('exam_date', d.examDate),
    hours: DOW_KEYS.map((k, i) => num(k, d.hours[i])),
    mode: kv.get('redistribution') === 'proportional' ? 'proportional' : 'uniform',
    mathShare: ms === undefined || ms === '' || ms === 'auto' || !Number.isFinite(msNum) ? 'auto' : Math.min(Math.max(msNum, 0), 1),
    revisionLoad: num('revision_load', d.revisionLoad, 0.1, 1),
    mockHours: num('mock_hours', d.mockHours, 0, 12),
  };
}

/* ---------- row parsers ---------- */

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
const numOr = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: unknown) => v === true || /^(true|yes|1)$/i.test(str(v));

const topicToRow = (t: Topic): Row => [t.id, t.section, t.subject, t.topic, t.track, t.est, t.order, t.active, t.doneOn, t.notes];

function parseTopic(r: Row): Topic | null {
  const id = str(r[0]);
  if (!id) return null;
  return {
    id,
    section: str(r[1]) || 'Other',
    subject: str(r[2]),
    topic: str(r[3]) || id,
    track: str(r[4]) === 'math' ? 'math' : 'core',
    est: Math.max(numOr(r[5], 0), 0),
    order: numOr(r[6], 999),
    active: r[7] === undefined || r[7] === '' ? true : bool(r[7]),
    doneOn: isISODate(str(r[8])) ? str(r[8]) : '',
    notes: str(r[9]),
  };
}

const LOG_TYPE_SET = new Set<LogType>(['study', 'pyq', 'revision', 'mock']);
function parseLog(r: Row): Log | null {
  const id = str(r[0]);
  const date = str(r[1]);
  const hours = numOr(r[3], NaN);
  if (!id || !isISODate(date) || !Number.isFinite(hours)) return null;
  const type = str(r[4]) as LogType;
  return {
    id,
    date,
    topicId: str(r[2]),
    hours,
    type: LOG_TYPE_SET.has(type) ? type : 'study',
    note: str(r[5]),
    createdAt: str(r[6]),
  };
}

function parseOverride(r: Row): Override | null {
  const date = str(r[0]);
  const hours = numOr(r[1], NaN);
  if (!isISODate(date) || !Number.isFinite(hours)) return null;
  return { date, hours: Math.max(hours, 0), reason: str(r[2]) };
}

function parseMock(r: Row): Mock | null {
  const id = str(r[0]);
  const date = str(r[1]);
  if (!id || !isISODate(date)) return null;
  return {
    id,
    date,
    name: str(r[2]) || 'Mock test',
    score: numOr(r[3]),
    max: numOr(r[4], 100) || 100,
    hours: numOr(r[5]),
    notes: str(r[6]),
  };
}

/* ---------- setup ---------- */

let setupDone = false;

export async function ensureSetup(): Promise<void> {
  if (setupDone) return;
  const existing = new Set((await getSheets()).map((s) => s.title));
  const missing = (Object.keys(TABS) as Tab[]).filter((t) => !existing.has(t));
  if (missing.length) {
    await batchUpdate(
      missing.map((title) => ({
        addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
      })),
    );
    for (const tab of missing) {
      await update(`${tab}!A1:${colLetter(TABS[tab].length)}1`, [[...TABS[tab]]]);
      if (tab === 'Topics') await append(fullRange('Topics'), SEED_TOPICS.map(topicToRow));
      if (tab === 'Settings') await append(fullRange('Settings'), settingsToRows(DEFAULT_SETTINGS));
    }
  }
  setupDone = true;
}

/* ---------- read ---------- */

async function readStore(): Promise<Store> {
  await ensureSetup();
  const [t, l, s, o, m] = await batchGet((Object.keys(TABS) as Tab[]).map(fullRange));
  const topics = t.map(parseTopic).filter((x): x is Topic => x !== null);
  return {
    topics: topics.sort((a, b) => a.order - b.order),
    logs: l.map(parseLog).filter((x): x is Log => x !== null),
    settings: rowsToSettings(s),
    overrides: o.map(parseOverride).filter((x): x is Override => x !== null),
    mocks: m.map(parseMock).filter((x): x is Mock => x !== null),
  };
}

export const loadStore = cache(readStore);

export type LoadResult = { ok: true; store: Store } | { ok: false; error: string; config: boolean };

export async function safeLoad(): Promise<LoadResult> {
  try {
    return { ok: true, store: await loadStore() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, config: e instanceof ConfigError };
  }
}

/* ---------- write helpers ---------- */

async function rowOf(tab: Tab, id: string): Promise<number> {
  const ids = await getColumn(`${tab}!A2:A`);
  const i = ids.indexOf(id);
  if (i < 0) throw new Error(`${tab} row ${id} not found`);
  return i + 2;
}

export const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10);

export async function addLog(log: Omit<Log, 'id' | 'createdAt'>): Promise<void> {
  await ensureSetup();
  await append(fullRange('Logs'), [
    [newId(), log.date, log.topicId, log.hours, log.type, log.note, new Date().toISOString()],
  ]);
}

export async function removeLog(id: string): Promise<void> {
  await deleteRow('Logs', await rowOf('Logs', id));
}

export async function setTopicField(id: string, field: 'est_hours' | 'active' | 'done_on' | 'order', value: string | number | boolean) {
  const row = await rowOf('Topics', id);
  const col = colLetter(TABS.Topics.indexOf(field) + 1);
  await update(`Topics!${col}${row}`, [[value]]);
}

export async function saveSettings(s: Settings): Promise<void> {
  await ensureSetup();
  await clear(fullRange('Settings'));
  await update(`Settings!A2:B${settingsToRows(s).length + 1}`, settingsToRows(s));
}

export async function upsertOverride(o: Override): Promise<void> {
  await ensureSetup();
  const dates = await getColumn('Overrides!A2:A');
  const i = dates.indexOf(o.date);
  if (i >= 0) await update(`Overrides!A${i + 2}:C${i + 2}`, [[o.date, o.hours, o.reason]]);
  else await append(fullRange('Overrides'), [[o.date, o.hours, o.reason]]);
}

export async function removeOverride(date: string): Promise<void> {
  await deleteRow('Overrides', await rowOf('Overrides', date));
}

export async function addMock(m: Omit<Mock, 'id'>): Promise<void> {
  await ensureSetup();
  const id = newId();
  await append(fullRange('Mocks'), [[id, m.date, m.name, m.score, m.max, m.hours, m.notes]]);
  if (m.hours > 0) {
    await append(fullRange('Logs'), [[newId(), m.date, `mock:${id}`, m.hours, 'mock', m.name, new Date().toISOString()]]);
  }
}

export async function removeMock(id: string): Promise<void> {
  await deleteRow('Mocks', await rowOf('Mocks', id));
  const logs = await batchGet([fullRange('Logs')]);
  const idx = logs[0].findIndex((r) => str(r[2]) === `mock:${id}`);
  if (idx >= 0) await deleteRow('Logs', idx + 2);
}

/** Restores the default syllabus (keeps logs). Topic ids are stable, so logs stay linked. */
export async function reseedTopics(): Promise<void> {
  await ensureSetup();
  await clear(fullRange('Topics'));
  await update(`Topics!A2:J${SEED_TOPICS.length + 1}`, SEED_TOPICS.map(topicToRow));
}
