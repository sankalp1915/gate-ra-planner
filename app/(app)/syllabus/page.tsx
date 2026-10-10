import { markTopicDone, reopenTopic, restoreSyllabus, setTopicEstimate, toggleTopic } from '@/app/actions';
import { Submit } from '@/components/Submit';
import { Flash, Meter, PageHead, SetupNotice, pct } from '@/components/ui';
import { fmtShort } from '@/lib/dates';
import { getPageData, one, type SP } from '@/lib/load';
import { fmtHn } from '@/lib/plan';
import { SECTION_ORDER } from '@/lib/seed';
import type { Topic } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Syllabus' };

export default async function SyllabusPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const data = await getPageData();
  if (!data.ok) return <SetupNotice error={data.error} config={data.config} />;
  const { store, plan, today } = data;

  const groups = new Map<string, Topic[]>();
  for (const t of store.topics) {
    if (!groups.has(t.section)) groups.set(t.section, []);
    groups.get(t.section)!.push(t);
  }
  const rank = (n: string) => (SECTION_ORDER.includes(n) ? SECTION_ORDER.indexOf(n) : 99);
  const ordered = [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  const load = plan.syllabus.capTotal > 0 ? plan.activeTotal / plan.syllabus.capTotal : 0;

  return (
    <>
      <Flash msg={one(sp.msg)} />
      <PageHead title="Syllabus">
        {store.topics.filter((t) => t.active).length} topics, {fmtHn(plan.activeTotal)} h estimated against{' '}
        {fmtHn(plan.syllabus.capTotal)} h of study time before {fmtShort(store.settings.syllabusEnd)} ({Math.round(load * 100)}%
        load). Change an estimate and every day’s target recalculates. Marking a topic done early frees its remaining hours.
      </PageHead>

      {ordered.map(([section, topics]) => {
        const sec = plan.sections.find((x) => x.name === section);
        const inactive = topics.every((t) => !t.active);
        return (
          <section key={section} className="group">
            <header>
              <div className="row between">
                <h2>{section}</h2>
                <span className="muted small">
                  {inactive ? 'Not in your plan' : `${sec?.done ?? 0}/${sec?.topics ?? 0} topics, ${pct(sec?.credited ?? 0, sec?.est ?? 0)}%`}
                </span>
              </div>
              {!inactive && sec ? <Meter value={sec.credited} max={sec.est} /> : null}
            </header>
            <div className="panel scroll" style={{ padding: '0.25rem 0.5rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th className="r">Estimate (h)</th>
                    <th className="r">Logged</th>
                    <th style={{ width: 120 }}>Progress</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((t) => {
                    const p = plan.progress.get(t.id)!;
                    const finished = t.active && p.remaining <= 0.001;
                    return (
                      <tr key={t.id} className={!t.active ? 'off' : finished ? 'done' : ''}>
                        <td>
                          <span className={`trackdot ${t.track}`} aria-hidden />
                          {t.topic}
                          <div className="muted small">{t.subject}</div>
                        </td>
                        <td className="r">
                          <form action={setTopicEstimate} className="inline">
                            <input type="hidden" name="id" value={t.id} />
                            <input type="hidden" name="back" value="/syllabus" />
                            <input
                              type="number"
                              name="est"
                              min="0"
                              max="200"
                              step="0.5"
                              defaultValue={t.est}
                              aria-label={`Estimate for ${t.topic}`}
                            />
                            <Submit className="btn ghost small" pending="…">
                              Save
                            </Submit>
                          </form>
                        </td>
                        <td className="r">{fmtHn(p.logged)}</td>
                        <td>
                          <Meter value={p.credited} max={t.est} tone={t.track} />
                        </td>
                        <td>
                          <div className="row" style={{ gap: '0.5rem' }}>
                            {!t.active ? (
                              <form action={toggleTopic}>
                                <input type="hidden" name="id" value={t.id} />
                                <input type="hidden" name="active" value="true" />
                                <input type="hidden" name="back" value="/syllabus" />
                                <Submit className="btn ghost small" pending="…">
                                  Add to plan
                                </Submit>
                              </form>
                            ) : t.doneOn ? (
                              <>
                                <span className="small up">Done {fmtShort(t.doneOn)}</span>
                                <form action={reopenTopic}>
                                  <input type="hidden" name="id" value={t.id} />
                                  <input type="hidden" name="back" value="/syllabus" />
                                  <Submit className="linkbtn" pending="…">
                                    Reopen
                                  </Submit>
                                </form>
                              </>
                            ) : (
                              <>
                                <form action={markTopicDone}>
                                  <input type="hidden" name="id" value={t.id} />
                                  <input type="hidden" name="date" value={today} />
                                  <input type="hidden" name="back" value="/syllabus" />
                                  <Submit className="btn ghost small" pending="…">
                                    Mark done
                                  </Submit>
                                </form>
                                <form action={toggleTopic}>
                                  <input type="hidden" name="id" value={t.id} />
                                  <input type="hidden" name="active" value="false" />
                                  <input type="hidden" name="back" value="/syllabus" />
                                  <Submit className="linkbtn" pending="…" confirm="Remove this topic from your plan?">
                                    Skip
                                  </Submit>
                                </form>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="section panel grid" style={{ maxWidth: '70ch' }}>
        <h2>Start the syllabus over</h2>
        <p className="muted">
          Restores the default topic list and estimates and clears completion marks. Your logged sessions stay, and because
          topic ids do not change they still count toward each topic.
        </p>
        <form action={restoreSyllabus}>
          <Submit className="btn ghost" pending="Restoring…" confirm="Restore the default syllabus? Estimates and done marks are reset.">
            Restore default syllabus
          </Submit>
        </form>
      </section>
    </>
  );
}
