import Link from 'next/link';
import { AllocList, Flash, Meter, PageHead, Scale, SetupNotice, TrackLegend, WeekStrip, pct } from '@/components/ui';
import { diffDays, fmtLong, fmtShort } from '@/lib/dates';
import { getPageData, one, type SP } from '@/lib/load';
import { fmtH, fmtHn, type PhasePlan } from '@/lib/plan';

export const dynamic = 'force-dynamic';

function phaseLine(p: PhasePlan, today: string, label: string) {
  const total = diffDays(p.start, p.end) + 1;
  const n = diffDays(p.start, today) + 1;
  return `${label}, day ${n} of ${total}.`;
}

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const data = await getPageData();
  if (!data.ok) return <SetupNotice error={data.error} config={data.config} />;
  const { plan, today } = data;
  const s = plan.settings;
  const daysToExam = diffDays(today, s.examDate);

  const active: PhasePlan | null =
    plan.phase === 'syllabus' || plan.phase === 'before' ? plan.syllabus : plan.phase === 'revision' ? plan.revision : null;
  const focusDate = plan.phase === 'before' ? s.startDate : today;
  const day = active?.days.get(focusDate);
  const week = active?.weeks.find((w) => w.start <= focusDate && w.end >= focusDate);

  const status =
    plan.phase === 'before'
      ? `Preparation starts ${fmtLong(s.startDate)}.`
      : plan.phase === 'syllabus'
        ? phaseLine(plan.syllabus, today, 'Syllabus phase')
        : plan.phase === 'revision'
          ? phaseLine(plan.revision, today, 'Revision month')
          : plan.phase === 'gap'
            ? `Syllabus window closed. Revision starts ${fmtLong(s.revisionStart)}.`
            : plan.phase === 'final'
              ? 'Final stretch: light revision, formula sheets and rest.'
              : 'Exam date has passed.';

  const pace = active ? active.creditedYesterday - active.baselineYesterday : 0;
  const leftToday = day ? Math.max(day.target - day.done, 0) : 0;

  return (
    <>
      <Flash msg={one(sp.msg)} />
      <PageHead title={fmtLong(today)}>
        {status} {daysToExam > 0 ? `${daysToExam} days to the exam (${fmtShort(s.examDate)}).` : null}
      </PageHead>

      {day && active ? (
        <section className="panel today" aria-label="Today">
          <div className="today-figure">
            <span className="big">{fmtHn(day.target)}</span>
            <span className="of">
              h planned {plan.phase === 'before' ? `for ${fmtShort(focusDate)}` : 'today'}, {fmtHn(day.done)} h done
            </span>
          </div>
          <Scale done={day.done} target={day.target} cap={day.cap} />
          <p>
            {day.target <= 0
              ? 'Nothing is planned today. Rest, or get ahead and lighten the rest of the week.'
              : leftToday <= 0.01
                ? 'Target reached. Anything extra you log now lightens the rest of this week.'
                : `${fmtH(leftToday)} to go.`}{' '}
            {day.target > day.cap + 0.01 ? (
              <span className="down">This is above your usual {fmtHn(day.cap)} h because earlier days fell short.</span>
            ) : null}
          </p>
          <div className="grid">
            <div className="row between">
              <h3>What to study</h3>
              <Link className="btn signal" href={`/tracker?date=${focusDate}`}>
                Log a session
              </Link>
            </div>
            <AllocList day={day} />
            <TrackLegend />
          </div>
        </section>
      ) : (
        <p className="panel">
          {plan.phase === 'gap' ? (
            <>Use these days to close gaps. Revision begins {fmtLong(s.revisionStart)}.</>
          ) : (
            <>Nothing scheduled for today.</>
          )}
        </p>
      )}

      {active && active.overflow > 0.1 ? (
        <p className="warn section">
          Even at full capacity every remaining day, {fmtH(active.overflow)} will not fit before {fmtShort(active.end)}.
          Add hours or a few long days in <Link href="/settings">Settings</Link>, or trim estimates on the{' '}
          <Link href="/syllabus">Syllabus</Link> page.
        </p>
      ) : null}

      <section className="section grid cols-4">
        <div className="panel stat">
          <span className="v">{pct(plan.syllabus.credited, plan.syllabus.total)}%</span>
          <span className="l">
            Syllabus covered, {fmtHn(plan.syllabus.credited)} of {fmtHn(plan.syllabus.total)} h
          </span>
        </div>
        <div className="panel stat">
          <span className={`v ${pace >= 0 ? 'up' : 'down'}`}>
            {pace >= 0 ? '+' : '−'}
            {fmtHn(Math.abs(pace))} h
          </span>
          <span className="l">{pace >= 0 ? 'Ahead of' : 'Behind'} the original pace, as of last night</span>
        </div>
        <div className="panel stat">
          <span className="v">
            {week ? `${fmtHn(week.done)}/${fmtHn(week.target)}` : '—'}
          </span>
          <span className="l">Hours this week, done of target</span>
        </div>
        <div className="panel stat">
          <span className="v">{fmtHn(active?.remaining ?? 0)} h</span>
          <span className="l">Left in the {active?.name === 'revision' ? 'revision month' : 'syllabus phase'}</span>
        </div>
      </section>

      {week ? (
        <section className="section">
          <div className="row between" style={{ marginBottom: '0.9rem' }}>
            <h2>This week</h2>
            <span className="muted small">Dark bar is done, yellow line is the target, dashed box is your usual hours.</span>
          </div>
          <div className="panel">
            <WeekStrip week={week} today={today} />
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="row between" style={{ marginBottom: '0.9rem' }}>
          <h2>Progress by section</h2>
          <Link href="/syllabus" className="small">
            Open syllabus
          </Link>
        </div>
        <div className="panel secs">
          {plan.sections.map((sec) => (
            <div key={sec.name} className="sec">
              <div className="row">
                <span>{sec.name}</span>
                <span className="muted small">
                  {sec.done}/{sec.topics} topics, {pct(sec.credited, sec.est)}%
                </span>
              </div>
              <Meter value={sec.credited} max={sec.est} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
