/**
 * Planning engine (pure functions, no I/O).
 *
 * How the targets move:
 *  1. A phase (syllabus or revision) has a total number of hours to cover and a
 *     capacity per day (4 h weekdays, 9 h weekends by default, overridable per date).
 *  2. At the start of each week the week's target is fixed as
 *        remaining hours at week start x (week capacity / capacity left in the phase).
 *     So a bad week shrinks nothing by magic: it raises every later week a little.
 *  3. Inside the current week, every day's base target is its share of the week target.
 *     Shortfall on earlier days is spread over the remaining days of the week
 *     ('uniform': equal hours per day, 'proportional': by each day's capacity).
 *     Surplus does the opposite, and today's surplus lightens later days immediately.
 *  4. Anything still left on Sunday night flows into the next week's target via step 2.
 *
 * Syllabus progress is measured in "credited hours": hours logged on a topic count
 * up to that topic's estimate, and marking a topic done credits whatever was left of
 * its estimate on that date. Finishing a topic early therefore reduces the load.
 */
import { addDays, dow, isWeekend, mondayOf, range } from './dates';
import { SECTION_ORDER } from './seed';
import type { Log, Mode, Settings, Store, Topic } from './types';

export type DayStatus = 'past' | 'today' | 'future';

export interface Alloc {
  kind: 'topic' | 'revision' | 'mock' | 'practice';
  key: string; // topic id, section name, or 'mock'
  label: string;
  sub?: string;
  section?: string;
  track?: 'math' | 'core';
  hours: number;
  /** true when this entry is something already logged (not a suggestion) */
  logged?: boolean;
}

export interface DayPlan {
  date: string;
  cap: number;
  base: number;
  target: number;
  done: number;
  status: DayStatus;
  alloc: Alloc[];
  override?: string;
}

export interface WeekPlan {
  start: string;
  end: string;
  days: DayPlan[];
  target: number;
  done: number;
  status: 'past' | 'current' | 'future';
}

export interface PhasePlan {
  name: 'syllabus' | 'revision';
  start: string;
  end: string;
  total: number;
  weeks: WeekPlan[];
  days: Map<string, DayPlan>;
  capTotal: number;
  credited: number; // through today
  remaining: number; // after today's credit
  /** credited hours the original (pre-start) pace expected by the end of yesterday */
  baselineYesterday: number;
  creditedYesterday: number;
  /** hours that will not fit if every remaining day were filled to capacity */
  overflow: number;
}

const EPS = 1e-6;
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
export const round2 = (x: number) => Math.round(x * 100) / 100;

export function capacityFn(s: Settings, overrides: { date: string; hours: number; reason: string }[]) {
  const map = new Map(overrides.map((o) => [o.date, o]));
  return {
    cap: (d: string) => map.get(d)?.hours ?? s.hours[dow(d)] ?? 0,
    reason: (d: string) => map.get(d)?.reason,
  };
}

/** Adds `amount` (may be negative) across `idxs`, never letting a value drop below zero. */
export function redistribute(arr: number[], idxs: number[], amount: number, caps: number[], mode: Mode): number[] {
  const out = arr.slice();
  let pool = idxs.filter((i) => caps[i] > 0);
  if (!pool.length) pool = idxs.slice();
  let amt = amount;
  for (let iter = 0; iter < 50 && Math.abs(amt) > EPS && pool.length; iter++) {
    const capSum = sum(pool.map((i) => caps[i]));
    const weight = (i: number) => (mode === 'uniform' || capSum <= 0 ? 1 / pool.length : caps[i] / capSum);
    let carry = 0;
    const next: number[] = [];
    for (const i of pool) {
      const v = out[i] + amt * weight(i);
      if (v < 0) {
        carry += v;
        out[i] = 0;
      } else {
        out[i] = v;
        next.push(i);
      }
    }
    amt = carry;
    pool = next;
  }
  return out;
}

interface PhaseInput {
  name: 'syllabus' | 'revision';
  start: string;
  end: string;
  total: number;
  credit: Map<string, number>;
  cap: (d: string) => number;
  reason: (d: string) => string | undefined;
  today: string;
  mode: Mode;
}

export function planPhase(p: PhaseInput): PhasePlan {
  const days = p.end >= p.start ? range(p.start, p.end) : [];
  const caps = days.map(p.cap);
  const suffix = new Array(days.length + 1).fill(0);
  for (let i = days.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + caps[i];
  const index = new Map(days.map((d, i) => [d, i]));
  const capTotal = suffix[0];

  const entries = [...p.credit.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const creditBefore = (d: string) => {
    let s = 0;
    for (const [k, v] of entries) {
      if (k < d) s += v;
      else break;
    }
    return s;
  };
  const c = (d: string) => p.credit.get(d) ?? 0;

  const weeks: WeekPlan[] = [];
  const dayMap = new Map<string, DayPlan>();
  let projected: number | null = null;

  for (let w = mondayOf(p.start); days.length && w <= p.end; w = addDays(w, 7)) {
    const wDays = range(w, addDays(w, 6)).filter((d) => d >= p.start && d <= p.end);
    const ws = wDays[0];
    const we = wDays[wDays.length - 1];
    const wCaps = wDays.map(p.cap);
    const capWeek = sum(wCaps);
    const status: WeekPlan['status'] = we < p.today ? 'past' : ws > p.today ? 'future' : 'current';
    const capFrom = suffix[index.get(ws)!];
    const share = (amount: number) =>
      wDays.map((_, i) => (capWeek > 0 ? (amount * wCaps[i]) / capWeek : amount / wDays.length));

    let weekTarget: number;
    let base: number[];
    let target: number[];

    if (status === 'future') {
      if (projected === null) projected = Math.max(p.total - creditBefore(ws), 0);
      weekTarget = capFrom > 0 ? (projected * capWeek) / capFrom : projected;
      base = share(weekTarget);
      target = base.slice();
      projected = Math.max(projected - weekTarget, 0);
    } else {
      const rem = Math.max(p.total - creditBefore(ws), 0);
      weekTarget = capFrom > 0 ? (rem * capWeek) / capFrom : rem;
      base = share(weekTarget);
      target = base.slice();
      if (status === 'current') {
        const ti = wDays.indexOf(p.today);
        let deviation = 0;
        for (let i = 0; i < ti; i++) deviation += base[i] - c(wDays[i]);
        const rest = wDays.map((_, i) => i).filter((i) => i >= ti);
        target = redistribute(base, rest, deviation, wCaps, p.mode);
        // past days keep their original base as the target they were measured against
        for (let i = 0; i < ti; i++) target[i] = base[i];
        const surplus = c(p.today) - target[ti];
        const later = rest.filter((i) => i > ti);
        if (surplus > EPS && later.length) target = redistribute(target, later, -surplus, wCaps, p.mode);
        const remainingNow = Math.max(p.total - creditBefore(addDays(p.today, 1)), 0);
        const plannedRest = Math.max(target[ti] - c(p.today), 0) + sum(later.map((i) => target[i]));
        projected = Math.max(remainingNow - plannedRest, 0);
      }
    }

    const dayPlans: DayPlan[] = wDays.map((d, i) => {
      const dp: DayPlan = {
        date: d,
        cap: wCaps[i],
        base: base[i],
        target: target[i],
        done: c(d),
        status: d < p.today ? 'past' : d === p.today ? 'today' : 'future',
        alloc: [],
        override: p.reason(d),
      };
      dayMap.set(d, dp);
      return dp;
    });

    weeks.push({
      start: ws,
      end: we,
      days: dayPlans,
      target: weekTarget,
      done: sum(wDays.map(c)),
      status,
    });
  }

  const yesterday = addDays(p.today, -1);
  const capToYesterday = days.filter((d) => d <= yesterday).reduce((s, d) => s + p.cap(d), 0);
  const baselineYesterday = capTotal > 0 ? (p.total * capToYesterday) / capTotal : 0;
  const creditedYesterday = creditBefore(p.today);
  const credited = creditBefore(addDays(p.today, 1));
  const remaining = Math.max(p.total - credited, 0);
  const capLeftToday = days.filter((d) => d >= p.today).reduce((s, d) => s + p.cap(d) - (d === p.today ? c(d) : 0), 0);

  return {
    name: p.name,
    start: p.start,
    end: p.end,
    total: p.total,
    weeks,
    days: dayMap,
    capTotal,
    credited,
    remaining,
    baselineYesterday,
    creditedYesterday,
    overflow: Math.max(remaining - Math.max(capLeftToday, 0), 0),
  };
}

/* ---------------- syllabus ---------------- */

export interface TopicProgress {
  topic: Topic;
  credited: number;
  logged: number;
  remaining: number;
  pct: number;
}

/** Credited hours per date and per topic for the syllabus phase. */
export function syllabusCredit(topics: Topic[], logs: Log[]) {
  const byDate = new Map<string, number>();
  const byTopic = new Map<string, number>();
  const logged = new Map<string, number>();
  const study = logs.filter((l) => l.type === 'study' || l.type === 'pyq');
  const grouped = new Map<string, Log[]>();
  for (const l of study) {
    logged.set(l.topicId, (logged.get(l.topicId) ?? 0) + l.hours);
    if (!grouped.has(l.topicId)) grouped.set(l.topicId, []);
    grouped.get(l.topicId)!.push(l);
  }
  for (const t of topics) {
    if (!t.active) continue;
    const events: { date: string; hours: number; done: boolean }[] = (grouped.get(t.id) ?? [])
      .slice()
      .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date < b.date ? -1 : 1))
      .map((l) => ({ date: l.date, hours: l.hours, done: false }));
    if (t.doneOn) {
      // the "done" credit lands after that day's logs
      const at = events.findIndex((e) => e.date > t.doneOn);
      events.splice(at < 0 ? events.length : at, 0, { date: t.doneOn, hours: 0, done: true });
    }
    let cr = 0;
    for (const e of events) {
      const add = e.done ? t.est - cr : Math.min(Math.max(e.hours, 0), t.est - cr);
      if (add > EPS) {
        cr += add;
        byDate.set(e.date, (byDate.get(e.date) ?? 0) + add);
      }
    }
    byTopic.set(t.id, cr);
  }
  return { byDate, byTopic, logged };
}

export function topicProgress(topics: Topic[], logs: Log[]): Map<string, TopicProgress> {
  const { byTopic, logged } = syllabusCredit(topics, logs);
  const out = new Map<string, TopicProgress>();
  for (const t of topics) {
    const credited = t.active ? byTopic.get(t.id) ?? 0 : 0;
    const remaining = t.active ? Math.max(t.est - credited, 0) : 0;
    out.set(t.id, {
      topic: t,
      credited,
      logged: logged.get(t.id) ?? 0,
      remaining,
      pct: t.est > 0 ? Math.min(credited / t.est, 1) : t.doneOn ? 1 : 0,
    });
  }
  return out;
}

interface QItem {
  t: Topic;
  rem: number;
}

function take(q: QItem[], hours: number, out: Alloc[]): number {
  let h = hours;
  while (h > EPS && q.length) {
    const it = q[0];
    const x = Math.min(it.rem, h);
    out.push({ kind: 'topic', key: it.t.id, label: it.t.topic, sub: it.t.subject, section: it.t.section, track: it.t.track, hours: x });
    it.rem -= x;
    h -= x;
    if (it.rem <= EPS) q.shift();
  }
  return h;
}

function mergeLogged(allocs: Alloc[]): Alloc[] {
  return merge(allocs).map((a) => ({ ...a, logged: true }));
}

function merge(allocs: Alloc[]): Alloc[] {
  const m = new Map<string, Alloc>();
  for (const a of allocs) {
    const k = a.kind + a.key;
    const prev = m.get(k);
    if (prev) prev.hours += a.hours;
    else m.set(k, { ...a });
  }
  return [...m.values()].filter((a) => a.hours > 0.005);
}

function actualAlloc(day: string, logs: Log[], topicsById: Map<string, Topic>): Alloc[] {
  const logged = actualLogs(day, logs, topicsById);
  const seen = new Set(logged.map((a) => a.key));
  const finished: Alloc[] = [...topicsById.values()]
    .filter((t) => t.active && t.doneOn === day && !seen.has(t.id))
    .map((t) => ({ kind: 'topic', key: t.id, label: `${t.topic} (marked done)`, sub: t.subject, section: t.section, track: t.track, hours: 0, logged: true }));
  return [...logged, ...finished];
}

function actualLogs(day: string, logs: Log[], topicsById: Map<string, Topic>): Alloc[] {
  return mergeLogged(
    logs
      .filter((l) => l.date === day)
      .map((l): Alloc => {
        if (l.type === 'mock') return { kind: 'mock', key: 'mock', label: l.note || 'Mock test', hours: l.hours };
        if (l.topicId.startsWith('section:')) {
          const sec = l.topicId.slice(8);
          return { kind: 'revision', key: l.topicId, label: `Revise ${sec}`, section: sec, hours: l.hours };
        }
        const t = topicsById.get(l.topicId);
        return {
          kind: l.type === 'revision' ? 'revision' : 'topic',
          key: l.topicId,
          label: t?.topic ?? l.note ?? 'Unlinked session',
          sub: t?.subject,
          section: t?.section,
          track: t?.track,
          hours: l.hours,
        };
      }),
  );
}

/* ---------------- full plan ---------------- */

export interface FullPlan {
  today: string;
  settings: Settings;
  syllabus: PhasePlan;
  revision: PhasePlan;
  progress: Map<string, TopicProgress>;
  sections: { name: string; est: number; credited: number; topics: number; done: number }[];
  revisionBlocks: { section: string; planned: number; done: number }[];
  mockPlanned: number;
  mockDone: number;
  phase: 'before' | 'syllabus' | 'gap' | 'revision' | 'final' | 'over';
  activeTotal: number;
}

export function buildPlan(store: Store, today: string): FullPlan {
  const s = store.settings;
  const { cap, reason } = capacityFn(s, store.overrides);
  const topicsById = new Map(store.topics.map((t) => [t.id, t]));
  const active = store.topics.filter((t) => t.active);
  const activeTotal = sum(active.map((t) => t.est));

  /* syllabus phase */
  const credit = syllabusCredit(store.topics, store.logs);
  const progress = topicProgress(store.topics, store.logs);
  const syllabus = planPhase({
    name: 'syllabus',
    start: s.startDate,
    end: s.syllabusEnd,
    total: activeTotal,
    credit: credit.byDate,
    cap,
    reason,
    today,
    mode: s.mode,
  });

  // topic queues from what is genuinely left right now
  const queue = (track: 'math' | 'core'): QItem[] =>
    active
      .filter((t) => t.track === track)
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ t, rem: progress.get(t.id)?.remaining ?? 0 }))
      .filter((q) => q.rem > EPS);
  const mathQ = queue('math');
  const coreQ = queue('core');
  const qSum = (q: QItem[]) => sum(q.map((x) => x.rem));

  for (const wk of syllabus.weeks) {
    for (const d of wk.days) {
      if (d.status === 'past') {
        d.alloc = actualAlloc(d.date, store.logs, topicsById);
        continue;
      }
      const planned: Alloc[] = [];
      const h = d.status === 'today' ? Math.max(d.target - d.done, 0) : d.target;
      if (h > EPS) {
        const mR = qSum(mathQ);
        const cR = qSum(coreQ);
        const share = s.mathShare === 'auto' ? (mR + cR > 0 ? mR / (mR + cR) : 0) : s.mathShare;
        let left = take(mathQ, h * share, planned);
        left = take(coreQ, h * (1 - share) + left, planned);
        if (left > EPS) take(mathQ, left, planned);
      }
      d.alloc = merge(planned);
      if (d.status === 'today') d.alloc = [...actualAlloc(d.date, store.logs, topicsById), ...d.alloc];
    }
  }

  /* revision phase */
  const revDays = s.revisionEnd >= s.revisionStart ? range(s.revisionStart, s.revisionEnd) : [];
  const revCap = sum(revDays.map(cap));
  const mockDays = revDays.filter((d) => isWeekend(d) && cap(d) >= s.mockHours && s.mockHours > 0);
  const mockPlanned = mockDays.length * s.mockHours;
  const revTotal = Math.round(revCap * s.revisionLoad * 10) / 10;
  const blockPool = Math.max(revTotal - mockPlanned, 0);
  const inRev = (l: Log) => l.date >= s.revisionStart && l.date <= s.revisionEnd;

  const rank = (n: string) => (SECTION_ORDER.includes(n) ? SECTION_ORDER.indexOf(n) : 99);
  const sectionNames = [...new Set(active.map((t) => t.section))].sort((a, b) => rank(a) - rank(b));
  const sectionEst = new Map(sectionNames.map((n) => [n, sum(active.filter((t) => t.section === n).map((t) => t.est))]));
  const revDoneBySection = new Map<string, number>();
  for (const l of store.logs.filter((l) => inRev(l) && l.type === 'revision')) {
    const sec = topicsById.get(l.topicId)?.section ?? l.topicId.replace(/^section:/, '');
    revDoneBySection.set(sec, (revDoneBySection.get(sec) ?? 0) + l.hours);
  }
  const revisionBlocks = sectionNames.map((n) => ({
    section: n,
    planned: activeTotal > 0 ? (blockPool * (sectionEst.get(n) ?? 0)) / activeTotal : 0,
    done: revDoneBySection.get(n) ?? 0,
  }));
  const mockDone = sum(store.logs.filter((l) => inRev(l) && l.type === 'mock').map((l) => l.hours));

  const revCredit = new Map<string, number>();
  for (const l of store.logs.filter(inRev)) revCredit.set(l.date, (revCredit.get(l.date) ?? 0) + l.hours);
  const revision = planPhase({
    name: 'revision',
    start: s.revisionStart,
    end: s.revisionEnd,
    total: revTotal,
    credit: revCredit,
    cap,
    reason,
    today,
    mode: s.mode,
  });

  // revision allocation: unfinished syllabus first (only once January has begun), then
  // one revision block per section, weekends carry a full mock.
  const catchUp: QItem[] = today >= s.revisionStart ? [...queue('math'), ...queue('core')] : [];
  const blocks = revisionBlocks.map((b) => ({ ...b, rem: Math.max(b.planned - b.done, 0) })).filter((b) => b.rem > EPS);
  let mocksLeft = Math.max(mockPlanned - mockDone, 0);
  for (const wk of revision.weeks) {
    for (const d of wk.days) {
      if (d.status === 'past') {
        d.alloc = actualAlloc(d.date, store.logs, topicsById);
        continue;
      }
      const planned: Alloc[] = [];
      let h = d.status === 'today' ? Math.max(d.target - d.done, 0) : d.target;
      const doneMockToday = d.status === 'today' && store.logs.some((l) => l.date === d.date && l.type === 'mock');
      if (isWeekend(d.date) && mocksLeft > EPS && h > EPS && !doneMockToday) {
        const m = Math.min(s.mockHours, h, mocksLeft);
        planned.push({ kind: 'mock', key: 'mock', label: 'Full-length mock + analysis', hours: m });
        mocksLeft -= m;
        h -= m;
      }
      h = take(catchUp, h, planned);
      while (h > EPS && blocks.length) {
        const b = blocks[0];
        const x = Math.min(b.rem, h);
        planned.push({ kind: 'revision', key: b.section, label: `Revise ${b.section}`, section: b.section, hours: x });
        b.rem -= x;
        h -= x;
        if (b.rem <= EPS) blocks.shift();
      }
      if (h > EPS) planned.push({ kind: 'practice', key: 'practice', label: 'Weak-area PYQs and error log', hours: h });
      d.alloc = merge(planned);
      if (d.status === 'today') d.alloc = [...actualAlloc(d.date, store.logs, topicsById), ...d.alloc];
    }
  }

  /* section summary */
  const sections = sectionNames.map((n) => {
    const ts = active.filter((t) => t.section === n);
    return {
      name: n,
      est: sum(ts.map((t) => t.est)),
      credited: sum(ts.map((t) => progress.get(t.id)?.credited ?? 0)),
      topics: ts.length,
      done: ts.filter((t) => (progress.get(t.id)?.remaining ?? 1) <= EPS).length,
    };
  });

  const phase: FullPlan['phase'] =
    today < s.startDate
      ? 'before'
      : today <= s.syllabusEnd
        ? 'syllabus'
        : today < s.revisionStart
          ? 'gap'
          : today <= s.revisionEnd
            ? 'revision'
            : today < s.examDate
              ? 'final'
              : 'over';

  return { today, settings: s, syllabus, revision, progress, sections, revisionBlocks, mockPlanned, mockDone, phase, activeTotal };
}

export const fmtH = (h: number) => {
  const r = Math.round(h * 4) / 4;
  if (r <= 0) return '0 h';
  const whole = Math.floor(r);
  const mins = Math.round((r - whole) * 60);
  if (!whole) return `${mins} min`;
  return mins ? `${whole} h ${mins} min` : `${whole} h`;
};
export const fmtHn = (h: number) => (Math.round(h * 10) / 10).toFixed(1);
