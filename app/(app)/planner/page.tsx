import Link from 'next/link';
import { AllocList, Flash, PageHead, SetupNotice, TrackLegend } from '@/components/ui';
import { fmtDayMonth, fmtShort } from '@/lib/dates';
import { getPageData, one, type SP } from '@/lib/load';
import { fmtHn, type Alloc, type DayPlan, type WeekPlan } from '@/lib/plan';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Planner' };

function DayCard({ d }: { d: DayPlan }) {
  const cls = d.status === 'today' ? 'is-today' : d.status === 'past' ? 'is-past' : '';
  return (
    <article className={`day ${cls}`}>
      <div className="day-meta">
        <span className="d">{fmtDayMonth(d.date)}</span>
        <span className="small">
          {d.status === 'past' ? `${fmtHn(d.done)} of ${fmtHn(d.target)} h` : `${fmtHn(d.target)} h target`}
        </span>
        {d.status === 'today' ? <span className="small">{fmtHn(d.done)} h done</span> : null}
        <span className="muted small">usual {fmtHn(d.cap)} h</span>
        {d.override ? <span className="muted small">{d.override}</span> : null}
        {d.target > d.cap + 0.01 ? <span className="down small">above usual hours</span> : null}
      </div>
      <AllocList day={d} />
    </article>
  );
}

function chips(w: WeekPlan) {
  const m = new Map<string, Alloc>();
  for (const d of w.days) for (const a of d.alloc) if (a.hours >= 0.05 && !m.has(a.kind + a.key)) m.set(a.kind + a.key, a);
  return [...m.values()];
}

function WeekRow({ w, label }: { w: WeekPlan; label: string }) {
  const cs = chips(w);
  return (
    <details className="wk">
      <summary>
        <span className="wk-title">
          {w.start === w.end ? fmtShort(w.start) : `${fmtShort(w.start)} to ${fmtShort(w.end)}`}
          <br />
          <span className="muted small">{label}</span>
        </span>
        <span>
          <span className="num">{fmtHn(w.status === 'past' ? w.done : w.target)}</span>{' '}
          <span className="muted small">{w.status === 'past' ? `of ${fmtHn(w.target)} h` : 'h'}</span>
        </span>
        <span className="chips">
          {cs.slice(0, 8).map((a) => (
            <span key={a.kind + a.key} className={`chip ${a.kind === 'topic' ? a.track ?? '' : ''}`} title={a.label}>
              {a.label}
            </span>
          ))}
          {cs.length > 8 ? <span className="chip">+{cs.length - 8} more</span> : null}
        </span>
      </summary>
      <div className="days">
        {w.days.map((d) => (
          <DayCard key={d.date} d={d} />
        ))}
      </div>
    </details>
  );
}

export default async function PlannerPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const data = await getPageData();
  if (!data.ok) return <SetupNotice error={data.error} config={data.config} />;
  const { plan, today } = data;
  const s = plan.settings;
  const phase = today <= s.syllabusEnd ? plan.syllabus : plan.revision;
  const focus = today < s.startDate ? s.startDate : today;
  const current = phase.weeks.find((w) => w.start <= focus && w.end >= focus);
  const modeText =
    s.mode === 'uniform'
      ? 'Hours you miss on a day are split equally across the rest of that week; extra hours take load off the rest of the week.'
      : 'Hours you miss on a day are split across the rest of the week in proportion to each day’s usual hours, so weekends absorb more.';

  return (
    <>
      <Flash msg={one(sp.msg)} />
      <PageHead title="Planner">
        {modeText} Whatever is still open on Sunday night is spread over the remaining weeks. Change this in{' '}
        <Link href="/settings">Settings</Link>.
      </PageHead>

      {current ? (
        <section>
          <div className="row between" style={{ marginBottom: '0.9rem' }}>
            <h2>
              This week, {fmtHn(current.done)} of {fmtHn(current.target)} h
            </h2>
            <TrackLegend />
          </div>
          <div className="days">
            {current.days.map((d) => (
              <DayCard key={d.date} d={d} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="section">
        <h2>Syllabus weeks, {fmtShort(s.startDate)} to {fmtShort(s.syllabusEnd)}</h2>
        <p className="muted small" style={{ margin: '-0.5rem 0 0.75rem' }}>
          Future weeks assume you hit this week’s targets. Open a week to see each day.
        </p>
        {plan.syllabus.weeks.map((w, i) => (
          <WeekRow
            key={w.start}
            w={w}
            label={w.status === 'current' ? 'This week' : w.status === 'past' ? `Week ${i + 1}, done` : `Week ${i + 1}`}
          />
        ))}
      </section>

      <section className="section">
        <h2>Revision weeks, {fmtShort(s.revisionStart)} to {fmtShort(s.revisionEnd)}</h2>
        <p className="muted small" style={{ margin: '-0.5rem 0 0.75rem' }}>
          Weekends carry a full mock; weekdays revise one section after another. Details on the{' '}
          <Link href="/revision">Revision</Link> page.
        </p>
        {plan.revision.weeks.map((w, i) => (
          <WeekRow key={w.start} w={w} label={w.status === 'current' ? 'This week' : `Revision week ${i + 1}`} />
        ))}
      </section>
    </>
  );
}
