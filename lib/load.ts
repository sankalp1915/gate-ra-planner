import 'server-only';
import { safeLoad } from './data';
import { appToday } from './dates';
import { buildPlan, type FullPlan } from './plan';
import type { Store } from './types';

export type PageData = { ok: true; store: Store; plan: FullPlan; today: string } | { ok: false; error: string; config: boolean };

export async function getPageData(): Promise<PageData> {
  const res = await safeLoad();
  if (!res.ok) return res;
  const today = appToday();
  return { ok: true, store: res.store, plan: buildPlan(res.store, today), today };
}

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
