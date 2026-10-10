import { deleteLog, logSession } from '@/app/actions';
import { Submit } from '@/components/Submit';
import { Flash, PageHead, SetupNotice } from '@/components/ui';
import { addDays, fmtDayMonth, isISODate, mondayOf, range } from '@/lib/dates';
import { getPageData, one, type SP } from '@/lib/load';
import { fmtHn } from '@/lib/plan';
import { LOG_TYPES, type Topic } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tracker' };

export default async function TrackerPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const data = await getPageData();
  if (!data.ok) return <SetupNotice error={data.error} config={data.config} />;
  const { store, plan, today } = data;
  const s = store.settings;

  const date = isISODate(one(sp.date)) ? one(sp.date) : today;
  const topicParam = one(sp.topic);
  const hoursParam = Number(one(sp.hours));
  const typeParam = LOG_TYPES.some((t) => t.value === one(sp.type)) ? one(sp.type) : 'study';
  const topicsById = new Map(store.topics.map((t) => [t.id, t]));

  // default topic: the one requested, else the first unfinished topic in today's plan
  const todayPlan = plan.syllabus.days.get(today) ?? plan.revision.days.get(today);
  const suggested = todayPlan?.alloc.find((a) => !a.logged && a.kind === 'topic')?.key;
  const selected = topicParam || suggested || '';

  const bySection = new Map<string, Topic[]>();
  for (const t of store.topics.filter((t) => t.active)) {
    if (!bySection.has(t.section)) bySection.set(t.section, []);
    bySection.get(t.section)!.push(t);
  }
  const sectionNames = plan.sections.map((x) => x.name);

  // heatmap across both phases
  const allDays = new Map([...plan.syllabus.days, ...plan.revision.days]);
  const hmStart = mondayOf(s.startDate);
  const hmEnd = addDays(mondayOf(s.revisionEnd), 6);
  const heat = range(hmStart, hmEnd).map((d) => {
    const p = allDays.get(d);
    if (!p) return { d, cls: 'blank', title: '' };
    const ratio = p.target > 0 ? p.done / p.target : p.done > 0 ? 1 : 0;
    let cls = '';
    if (p.done > 0) cls = ratio >= 1 ? 'l3' : ratio >= 0.6 ? 'l2' : 'l1';
    else if (p.status === 'past' && p.target > 0.25) cls = 'miss';
    if (d === today) cls += ' now';
    return { d, cls, title: `${fmtDayMonth(d)}: ${fmtHn(p.done)} of ${fmtHn(p.target)} h` };
  });

  const logs = store.logs
    .slice()
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : a.date < b.date ? 1 : -1));
  const totalLogged = logs.reduce((x, l) => x + l.hours, 0);
  const daysSoFar = Math.max(range(s.startDate, today < s.startDate ? s.startDate : today).length, 1);

  const label = (id: string) => {
    if (id.startsWith('section:')) return `Revise ${id.slice(8)}`;
    if (id.startsWith('mock:')) return 'Mock test';
    return topicsById.get(id)?.topic ?? id;
  };

  return (
    <>
      <Flash msg={one(sp.msg)} />
      <PageHead title="Tracker">
        Log what you actually studied. Every entry updates today’s target, the rest of the week and the plan ahead.
      </PageHead>

      <div className="grid cols-2">
        <section className="panel">
          <h2 style={{ marginBottom: '1rem' }}>Log a session</h2>
          <form action={logSession} className="stack">
            <input type="hidden" name="back" value="/tracker" />
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Date
                <input type="date" name="date" defaultValue={date} max={addDays(today, 1)} required />
              </label>
              <label className="field">
                Hours
                <input
                  type="number"
                  name="hours"
                  min="0.25"
                  max="16"
                  step="0.25"
                  defaultValue={Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : 1}
                  required
                />
              </label>
            </div>
            <label className="field">
              Topic
              <select name="topic" defaultValue={selected} required>
                <option value="" disabled>
                  Choose a topic
                </option>
                <optgroup label="Revise a whole section">
                  {sectionNames.map((n) => (
                    <option key={n} value={`section:${n}`}>
                      Revise {n}
                    </option>
                  ))}
                </optgroup>
                {[...bySection.entries()].map(([sec, ts]) => (
                  <optgroup key={sec} label={sec}>
                    {ts.map((t) => (
                      <option key={t.id} value={t.id}>
                        {plan.progress.get(t.id)!.remaining <= 0.001 ? '✓ ' : ''}
                        {t.subject}: {t.topic}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="field">
              Kind of session
              <select name="type" defaultValue={typeParam}>
                {LOG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="hint">Study and PYQ hours count toward finishing the topic. Revision hours count toward the January plan.</span>
            </label>
            <label className="field">
              Note <span className="hint">optional, e.g. which PYQ years or what to revisit</span>
              <textarea name="note" maxLength={300} />
            </label>
            <label className="check">
              <input type="checkbox" name="complete" /> I have finished this topic
            </label>
            <div>
              <Submit pending="Logging…">Log session</Submit>
            </div>
          </form>
        </section>

        <section className="panel grid" style={{ alignContent: 'start' }}>
          <h2>Consistency</h2>
          <div className="grid cols-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
            <div className="stat">
              <span className="v">{fmtHn(totalLogged)}</span>
              <span className="l">hours logged</span>
            </div>
            <div className="stat">
              <span className="v">{logs.length}</span>
              <span className="l">sessions</span>
            </div>
            <div className="stat">
              <span className="v">{fmtHn(totalLogged / daysSoFar)}</span>
              <span className="l">h per day so far</span>
            </div>
          </div>
          <div className="scroll">
            <div className="heat" aria-label="Daily study heatmap, Monday at top">
              {heat.map((h) => (
                <span key={h.d} className={h.cls} title={h.title} />
              ))}
            </div>
          </div>
          <p className="muted small">
            Columns are weeks from October to January, Monday at the top. Green means you hit the day’s target, light
            green partly, red marks a missed day.
          </p>
        </section>
      </div>

      <section className="section">
        <h2>Recent sessions</h2>
        {logs.length === 0 ? (
          <p className="panel muted">No sessions yet. Log your first one above and the plan starts adapting.</p>
        ) : (
          <div className="panel scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>What</th>
                  <th>Kind</th>
                  <th className="r">Hours</th>
                  <th>
                    <span style={{ position: 'absolute', left: -9999 }}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 60).map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDayMonth(l.date)}</td>
                    <td>
                      {label(l.topicId)}
                      {l.note ? <div className="muted small">{l.note}</div> : null}
                    </td>
                    <td className="muted">{l.type}</td>
                    <td className="r">{fmtHn(l.hours)}</td>
                    <td className="r">
                      {l.type === 'mock' ? (
                        <span className="muted small">delete on Revision</span>
                      ) : (
                        <form action={deleteLog}>
                          <input type="hidden" name="id" value={l.id} />
                          <input type="hidden" name="back" value="/tracker" />
                          <Submit className="linkbtn" pending="Deleting…" confirm="Delete this session?">
                            Delete
                          </Submit>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
