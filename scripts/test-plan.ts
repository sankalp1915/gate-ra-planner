/* Sanity checks for the planning engine. Run: npm run test:plan */
import assert from 'node:assert/strict';
import { buildPlan, fmtHn } from '../lib/plan';
import { DEFAULT_SETTINGS, SEED_TOPICS } from '../lib/seed';
import type { Log, Store } from '../lib/types';

const base = (): Store => ({
  topics: SEED_TOPICS.map((t) => ({ ...t })),
  logs: [],
  settings: { ...DEFAULT_SETTINGS, hours: [...DEFAULT_SETTINGS.hours] },
  overrides: [],
  mocks: [],
});
let n = 0;
const log = (date: string, topicId: string, hours: number, type: Log['type'] = 'study'): Log => ({
  id: String(++n), date, topicId, hours, type, note: '', createdAt: `${date}T20:00:${String(n).padStart(2, '0')}Z`,
});
const week = (p: ReturnType<typeof buildPlan>, date: string) => p.syllabus.weeks.find((w) => w.start <= date && w.end >= date)!;
const tgt = (p: ReturnType<typeof buildPlan>, date: string) => p.syllabus.days.get(date)!.target;
const close = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

// 1. Fresh start
const p0 = buildPlan(base(), '2026-10-11');
console.log('active syllabus hours', p0.activeTotal, 'capacity', p0.syllabus.capTotal);
console.log('weeks', p0.syllabus.weeks.length, 'today target', fmtHn(tgt(p0, '2026-10-11')));
const ratio = p0.activeTotal / p0.syllabus.capTotal;
close(tgt(p0, '2026-10-13'), 4 * ratio, 'weekday target = 4h x load ratio');
close(tgt(p0, '2026-10-17'), 9 * ratio, 'weekend target = 9h x load ratio');
const allocSum = [...p0.syllabus.days.values()].reduce((s, d) => s + d.alloc.reduce((a, x) => a + x.hours, 0), 0);
assert.ok(Math.abs(allocSum - p0.activeTotal) < 0.2, 'all topics get scheduled exactly once');
const lastDay = p0.syllabus.days.get('2026-12-31')!;
console.log('Dec 31 plan:', lastDay.alloc.map((a) => `${a.label} ${fmtHn(a.hours)}`).join(' | '));

// 2. Monday short by 2h -> Tue..Sun each get +2/6 (uniform)
const s2 = base();
const mon = '2026-10-12';
const w2 = week(buildPlan(s2, mon), mon);
const baseMon = w2.days[0].base;
s2.logs.push(log(mon, 'M01', baseMon - 2));
const p2 = buildPlan(s2, '2026-10-13');
const w2b = week(p2, '2026-10-13');
for (const d of w2b.days.slice(1)) close(d.target, d.base + 2 / 6, `uniform shortfall on ${d.date}`);
close(w2b.target, w2.target, 'week total unchanged inside the week');
console.log('after 2h shortfall, Tue target', fmtHn(w2b.days[1].target), 'Sat', fmtHn(w2b.days[5].target));

// 3. Monday over by 3h -> rest of week lighter, next week unchanged in total
const s3 = base();
s3.logs.push(log(mon, 'M01', 6), log(mon, 'C01', baseMon + 3 - 6));
const p3 = buildPlan(s3, '2026-10-13');
const w3 = week(p3, '2026-10-13');
for (const d of w3.days.slice(1)) close(d.target, d.base - 3 / 6, `uniform surplus on ${d.date}`);

// 4. Surplus earned today lightens later days immediately
const s4 = base();
s4.logs.push(log('2026-10-13', 'M01', 6), log('2026-10-13', 'C01', 2));
const p4 = buildPlan(s4, '2026-10-13');
const w4 = week(p4, '2026-10-13');
const monShort = w4.days[0].base / 6; // Monday (nothing logged) spread over Tue..Sun
const extra = 8 - w4.days[1].target;
for (const d of w4.days.slice(2)) close(d.target, d.base + monShort - extra / 5, `today surplus on ${d.date}`);

// 5. Proportional mode puts more of a shortfall on weekends
const s5 = base();
s5.settings.mode = 'proportional';
s5.logs.push(log(mon, 'M01', 0.5));
const w5 = week(buildPlan(s5, '2026-10-13'), '2026-10-13');
assert.ok(w5.days[5].target - w5.days[5].base > w5.days[1].target - w5.days[1].base, 'weekend absorbs more');

// 6. Missed week rolls into later weeks
const s6 = base();
const p6 = buildPlan(s6, '2026-10-19');
const w6next = week(p6, '2026-10-26');
const p6b = buildPlan(base(), '2026-10-11');
assert.ok(w6next.target > week(p6b, '2026-10-26').target, 'later weeks heavier after a missed week');

// 7. Marking a topic done early credits its remaining estimate
const s7 = base();
s7.logs.push(log('2026-10-13', 'C04', 1));
s7.topics.find((t) => t.id === 'C04')!.doneOn = '2026-10-13';
const p7 = buildPlan(s7, '2026-10-13');
close(p7.syllabus.days.get('2026-10-13')!.done, 6, 'done credits full estimate');

// 8. Overloaded day off: override Wed to 0, target moves elsewhere
const s8 = base();
s8.overrides.push({ date: '2026-10-14', hours: 0, reason: 'office offsite' });
const p8 = buildPlan(s8, '2026-10-12');
close(tgt(p8, '2026-10-14'), 0, 'zero-capacity day has no target');

// 9. Revision month
const p9 = buildPlan(base(), '2027-01-02');
console.log('revision total', fmtHn(p9.revision.total), 'mock hours', p9.mockPlanned, 'Sat Jan 2:',
  p9.revision.days.get('2027-01-02')!.alloc.map((a) => `${a.label} ${fmtHn(a.hours)}`).join(' | '));
assert.equal(p9.phase, 'revision');

console.log('all engine checks passed');
