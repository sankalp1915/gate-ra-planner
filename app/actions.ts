'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as db from '@/lib/data';
import { SESSION_COOKIE, safeEqual, sessionToken } from '@/lib/auth';
import { appToday, isISODate } from '@/lib/dates';
import type { LogType, Settings } from '@/lib/types';

const text = (f: FormData, k: string, max = 300) => String(f.get(k) ?? '').trim().slice(0, max);
const num = (f: FormData, k: string) => Number(String(f.get(k) ?? '').replace(',', '.'));
const safeBack = (f: FormData, fallback: string) => {
  const b = text(f, 'back', 200);
  return b.startsWith('/') && !b.startsWith('//') ? b : fallback;
};
const done = (path: string, msg?: string) => {
  revalidatePath('/', 'layout');
  const sep = path.includes('?') ? '&' : '?';
  redirect(msg ? `${path}${sep}msg=${encodeURIComponent(msg)}` : path);
};

/* ---------- logs ---------- */

export async function logSession(f: FormData) {
  const date = text(f, 'date', 10);
  const topicId = text(f, 'topic', 120);
  const hours = num(f, 'hours');
  const type = text(f, 'type', 12) as LogType;
  const back = safeBack(f, '/tracker');
  if (!isISODate(date)) return done(back, 'Pick a valid date.');
  if (!topicId) return done(back, 'Choose what you studied.');
  if (!Number.isFinite(hours) || hours <= 0 || hours > 16) return done(back, 'Hours must be between 0.25 and 16.');
  if (!['study', 'pyq', 'revision'].includes(type)) return done(back, 'Unknown session type.');
  await db.addLog({ date, topicId, hours: Math.round(hours * 100) / 100, type, note: text(f, 'note') });
  if (f.get('complete') === 'on' && !topicId.startsWith('section:')) await db.setTopicField(topicId, 'done_on', date);
  done(back, `Logged ${hours} h.`);
}

export async function deleteLog(f: FormData) {
  await db.removeLog(text(f, 'id', 40));
  done(safeBack(f, '/tracker'), 'Session deleted.');
}

/* ---------- topics ---------- */

export async function markTopicDone(f: FormData) {
  const id = text(f, 'id', 40);
  const date = text(f, 'date', 10);
  await db.setTopicField(id, 'done_on', isISODate(date) ? date : appToday());
  done(safeBack(f, '/syllabus'), 'Marked complete.');
}

export async function reopenTopic(f: FormData) {
  await db.setTopicField(text(f, 'id', 40), 'done_on', '');
  done(safeBack(f, '/syllabus'), 'Topic reopened.');
}

export async function setTopicEstimate(f: FormData) {
  const est = num(f, 'est');
  if (!Number.isFinite(est) || est < 0 || est > 200) return done(safeBack(f, '/syllabus'), 'Estimate must be 0–200 h.');
  await db.setTopicField(text(f, 'id', 40), 'est_hours', Math.round(est * 4) / 4);
  done(safeBack(f, '/syllabus'), 'Estimate saved. The plan has been recalculated.');
}

export async function toggleTopic(f: FormData) {
  await db.setTopicField(text(f, 'id', 40), 'active', text(f, 'active') === 'true');
  done(safeBack(f, '/syllabus'));
}

export async function restoreSyllabus() {
  await db.reseedTopics();
  done('/syllabus', 'Default syllabus restored. Your logs were kept.');
}

/* ---------- settings ---------- */

export async function updateSettings(f: FormData) {
  const current = (await db.loadStore()).settings;
  const dates = ['startDate', 'syllabusEnd', 'revisionStart', 'revisionEnd', 'examDate'] as const;
  const next: Settings = { ...current, hours: [...current.hours] };
  for (const k of dates) {
    const v = text(f, k, 10);
    if (!isISODate(v)) return done('/settings', 'Every date needs to be a valid date.');
    next[k] = v;
  }
  if (!(next.startDate <= next.syllabusEnd && next.syllabusEnd < next.revisionStart && next.revisionStart <= next.revisionEnd))
    return done('/settings', 'Dates must run in order: start, syllabus end, revision start, revision end.');
  for (let i = 0; i < 7; i++) {
    const h = num(f, `h${i}`);
    if (!Number.isFinite(h) || h < 0 || h > 16) return done('/settings', 'Daily hours must be between 0 and 16.');
    next.hours[i] = h;
  }
  next.mode = text(f, 'mode') === 'proportional' ? 'proportional' : 'uniform';
  const share = text(f, 'mathShare');
  next.mathShare = share === 'auto' || share === '' ? 'auto' : Math.min(Math.max(Number(share) / 100, 0), 1);
  if (next.mathShare !== 'auto' && !Number.isFinite(next.mathShare)) next.mathShare = 'auto';
  const load = num(f, 'revisionLoad');
  next.revisionLoad = Number.isFinite(load) ? Math.min(Math.max(load / 100, 0.1), 1) : current.revisionLoad;
  const mock = num(f, 'mockHours');
  next.mockHours = Number.isFinite(mock) ? Math.min(Math.max(mock, 0), 12) : current.mockHours;
  await db.saveSettings(next);
  done('/settings', 'Settings saved. The plan has been recalculated.');
}

export async function saveOverride(f: FormData) {
  const date = text(f, 'date', 10);
  const hours = num(f, 'hours');
  if (!isISODate(date) || !Number.isFinite(hours) || hours < 0 || hours > 16)
    return done(safeBack(f, '/settings'), 'Give a date and 0–16 hours.');
  await db.upsertOverride({ date, hours, reason: text(f, 'reason', 120) });
  done(safeBack(f, '/settings'), 'Day updated.');
}

export async function deleteOverride(f: FormData) {
  await db.removeOverride(text(f, 'date', 10));
  done(safeBack(f, '/settings'), 'Back to the usual hours for that day.');
}

/* ---------- mocks ---------- */

export async function logMock(f: FormData) {
  const date = text(f, 'date', 10);
  const score = num(f, 'score');
  const max = num(f, 'max') || 100;
  const hours = num(f, 'hours');
  if (!isISODate(date) || !Number.isFinite(score)) return done('/revision', 'A mock needs a date and a score.');
  await db.addMock({
    date,
    name: text(f, 'name', 80) || 'Mock test',
    score,
    max,
    hours: Number.isFinite(hours) && hours >= 0 ? hours : 0,
    notes: text(f, 'notes'),
  });
  done('/revision', 'Mock saved.');
}

export async function deleteMock(f: FormData) {
  await db.removeMock(text(f, 'id', 40));
  done('/revision', 'Mock deleted.');
}

/* ---------- auth ---------- */

export async function login(f: FormData) {
  const password = process.env.APP_PASSWORD;
  const next = text(f, 'next', 200);
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (!password) redirect(target);
  if (!safeEqual(text(f, 'password', 200), password)) redirect(`/login?error=1&next=${encodeURIComponent(target)}`);
  (await cookies()).set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
  redirect(target);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
