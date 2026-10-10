import { deleteMock, logMock } from '@/app/actions';
import { Submit } from '@/components/Submit';
import { Flash, Meter, PageHead, SetupNotice, pct } from '@/components/ui';
import { diffDays, fmtDayMonth, fmtShort } from '@/lib/dates';
import { getPageData, one, type SP } from '@/lib/load';
import { fmtH, fmtHn } from '@/lib/plan';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revision' };

function ScoreChart({ points }: { points: { date: string; p: number }[] }) {
  if (points.length < 2) return null;
  const W = 600;
  const H = 160;
  const pad = 24;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (points.length - 1);
  const y = (p: number) => H - pad - (p / 100) * (H - 2 * pad);
  const d = points.map((pt, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(pt.p).toFixed(1)}`).join(' ');
  return (
    <div className="scroll">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: 'block' }} role="img" aria-label="Mock score trend">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke="var(--rule)" strokeWidth="1" />
            <text x={2} y={y(g) + 4} fontSize="10" fill="var(--steel)">
              {g}
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth="2.5" />
        {points.map((pt, i) => (
          <circle key={i} cx={x(i)} cy={y(pt.p)} r="4" fill="var(--signal)" stroke="var(--ink)" strokeWidth="1.5" />
        ))}
      </svg>
    </div>
  );
}

export default async function RevisionPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const data = await getPageData();
  if (!data.ok) return <SetupNotice error={data.error} config={data.config} />;
  const { store, plan, today } = data;
  const s = store.settings;
  const rev = plan.revision;
  const until = diffDays(today, s.revisionStart);
  const mocks = store.mocks.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const days = rev.weeks.flatMap((w) => w.days);

  return (
    <>
      <Flash msg={one(sp.msg)} />
      <PageHead title="Revision month">
        {fmtShort(s.revisionStart)} to {fmtShort(s.revisionEnd)}: {fmtHn(rev.total)} h planned ({Math.round(s.revisionLoad * 100)}% of
        your available {fmtHn(rev.capTotal)} h), including {fmtHn(plan.mockPlanned)} h of full-length mocks on weekends.{' '}
        {until > 0 ? `Starts in ${until} days; the schedule below is a preview.` : null}
      </PageHead>

      <div className="grid cols-2">
        <section className="panel grid" style={{ alignContent: 'start' }}>
          <h2>Revision by section</h2>
          <div className="secs">
            {plan.revisionBlocks.map((b) => (
              <div key={b.section} className="sec">
                <div className="row">
                  <span>{b.section}</span>
                  <span className="muted small">
                    {fmtHn(b.done)} of {fmtHn(b.planned)} h
                  </span>
                </div>
                <Meter value={b.done} max={b.planned} tone="go" />
              </div>
            ))}
            <div className="sec">
              <div className="row">
                <span>Full-length mocks</span>
                <span className="muted small">
                  {fmtHn(plan.mockDone)} of {fmtHn(plan.mockPlanned)} h
                </span>
              </div>
              <Meter value={plan.mockDone} max={plan.mockPlanned} />
            </div>
          </div>
          <p className="muted small">
            Section hours are split in proportion to each section’s study estimate. Log revision from the Tracker by
            choosing a whole section or a single topic with the kind set to Revision.
          </p>
        </section>

        <section className="panel" id="log-mock">
          <h2 style={{ marginBottom: '1rem' }}>Log a mock test</h2>
          <form action={logMock} className="stack">
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Date
                <input type="date" name="date" defaultValue={today} required />
              </label>
              <label className="field">
                Hours spent <span className="hint">test + analysis</span>
                <input type="number" name="hours" min="0" max="12" step="0.25" defaultValue={s.mockHours} />
              </label>
            </div>
            <label className="field">
              Name
              <input type="text" name="name" maxLength={80} placeholder="e.g. Full-length mock 3" />
            </label>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Score
                <input type="number" name="score" step="0.01" min="-50" max="200" required />
              </label>
              <label className="field">
                Out of
                <input type="number" name="max" step="1" min="1" defaultValue={100} />
              </label>
            </div>
            <label className="field">
              What went wrong <span className="hint">optional; feeds your error log</span>
              <textarea name="notes" maxLength={300} />
            </label>
            <div>
              <Submit pending="Saving…">Save mock</Submit>
            </div>
          </form>
        </section>
      </div>

      <section className="section">
        <h2>Mock scores</h2>
        {mocks.length === 0 ? (
          <p className="panel muted">No mocks logged yet. Sectional tests during the syllabus phase can be logged here too.</p>
        ) : (
          <div className="panel grid">
            <ScoreChart points={mocks.map((m) => ({ date: m.date, p: pct(m.score, m.max) }))} />
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Mock</th>
                    <th className="r">Score</th>
                    <th className="r">%</th>
                    <th>Notes</th>
                    <th>
                      <span style={{ position: 'absolute', left: -9999 }}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mocks.map((m) => (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDayMonth(m.date)}</td>
                      <td>{m.name}</td>
                      <td className="r">
                        {m.score}/{m.max}
                      </td>
                      <td className="r">{pct(m.score, m.max)}</td>
                      <td className="muted small">{m.notes}</td>
                      <td className="r">
                        <form action={deleteMock}>
                          <input type="hidden" name="id" value={m.id} />
                          <Submit className="linkbtn" pending="…" confirm="Delete this mock and its logged hours?">
                            Delete
                          </Submit>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="section">
        <h2>January schedule</h2>
        <div className="panel scroll">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th className="r">Target</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className={d.status === 'past' ? 'done' : ''} style={d.status === 'today' ? { boxShadow: 'inset 4px 0 0 var(--signal)' } : undefined}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDayMonth(d.date)}</td>
                  <td className="r">{d.status === 'past' ? `${fmtHn(d.done)}/${fmtHn(d.target)}` : fmtHn(d.target)}</td>
                  <td>
                    {d.alloc
                      .filter((a) => a.hours >= 0.05)
                      .map((a) => `${a.label} (${fmtH(a.hours)})`)
                      .join('; ') || <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
