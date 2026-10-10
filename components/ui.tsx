import Link from 'next/link';
import { addDays, fmtDow, mondayOf } from '@/lib/dates';
import { fmtH, fmtHn, type Alloc, type DayPlan, type WeekPlan } from '@/lib/plan';

export function PageHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="head">
      <h1>{title}</h1>
      {children ? <p className="muted">{children}</p> : null}
    </header>
  );
}

export function Flash({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flash" role="status">
      {msg}
    </p>
  );
}

export function SetupNotice({ error, config }: { error: string; config: boolean }) {
  return (
    <div className="grid" style={{ maxWidth: '70ch' }}>
      <h1>{config ? 'Connect your Google Sheet' : 'Could not reach Google Sheets'}</h1>
      <p className="warn">{error}</p>
      {config ? (
        <ol className="grid" style={{ paddingLeft: '1.2rem' }}>
          <li>Create a Google Cloud service account, enable the Google Sheets API and download its JSON key.</li>
          <li>Create an empty Google Sheet and share it with the service-account email as Editor.</li>
          <li>
            Add <code>GOOGLE_SHEET_ID</code>, <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> and <code>GOOGLE_PRIVATE_KEY</code>{' '}
            (or <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>) to your Vercel project, then redeploy.
          </li>
          <li>Open the site again. The tabs and the full RA syllabus are created for you on first load.</li>
        </ol>
      ) : (
        <p className="muted">Reload the page in a moment. If it keeps happening, check the Vercel function logs.</p>
      )}
    </div>
  );
}

export function Meter({ value, max, tone }: { value: number; max: number; tone?: 'math' | 'core' | 'go' }) {
  const pct = max > 0 ? Math.min(value / max, 1) * 100 : 0;
  return (
    <div className={`meter ${tone ?? ''}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/** The measuring scale: ruler ticks per hour and quarter hour, filled to what is done, with the target marked. */
export function Scale({ done, target, cap }: { done: number; target: number; cap: number }) {
  const n = Math.max(Math.ceil(Math.max(cap, target, done, 1)), 1);
  const pct = (x: number) => `${Math.min(x / n, 1) * 100}%`;
  return (
    <div>
      <div
        className="scale"
        style={{ ['--n' as string]: n }}
        role="img"
        aria-label={`${fmtH(done)} done of ${fmtH(target)} planned today`}
      >
        <div className="scale-ticks" />
        <div className="scale-fill" style={{ width: pct(done) }} />
        {target > 0 ? (
          <div className={`scale-target ${target / n > 0.6 ? 'flip' : ''}`} style={{ left: pct(target) }}>
            <span>target {fmtHn(target)} h</span>
          </div>
        ) : null}
      </div>
      <div className="scale-labels" aria-hidden>
        {Array.from({ length: n + 1 }, (_, i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
    </div>
  );
}

export function WeekStrip({ week, today }: { week: WeekPlan; today: string }) {
  const max = Math.max(...week.days.map((d) => Math.max(d.cap, d.target, d.done)), 1);
  const h = (x: number) => `${Math.min(x / max, 1) * 100}%`;
  const monday = mondayOf(week.start);
  const slots = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const byDate = new Map(week.days.map((d) => [d.date, d]));
  return (
    <div className="week">
      {slots.map((date) => {
        const d = byDate.get(date);
        if (!d)
          return (
            <div key={date} className="wday" aria-hidden>
              <div className="wbar" />
              <span>{fmtDow(date)}</span>
              <span className="small">–</span>
            </div>
          );
        return (
        <div key={d.date} className={`wday ${d.date === today ? 'is-today' : ''}`}>
          <div className="wbar" title={`${fmtDow(d.date)}: ${fmtHn(d.done)} of ${fmtHn(d.target)} h`}>
            <div className="cap" style={{ height: h(d.cap) }} />
            <div className="dn" style={{ height: h(d.done) }} />
            <div className="tg" style={{ bottom: h(d.target) }} />
          </div>
          <span>{fmtDow(d.date)}</span>
          <span className="small">
            {fmtHn(d.done)}/{fmtHn(d.target)}
          </span>
        </div>
        );
      })}
    </div>
  );
}

function logHref(a: Alloc, date: string) {
  if (a.kind === 'mock') return '/revision#log-mock';
  if (a.kind === 'practice') return `/tracker?type=pyq&date=${date}`;
  const topic = a.kind === 'revision' && !a.track ? `section:${a.key}` : a.key;
  const type = a.kind === 'revision' ? 'revision' : 'study';
  return `/tracker?topic=${encodeURIComponent(topic)}&hours=${Math.round(a.hours * 4) / 4}&type=${type}&date=${date}`;
}

export function AllocList({ day, empty }: { day: DayPlan; empty?: string }) {
  const items = day.alloc.filter((a) => a.hours >= 0.05 || a.logged);
  if (!items.length)
    return <p className="muted small">{empty ?? (day.status === 'past' ? 'Nothing logged.' : 'Nothing planned.')}</p>;
  return (
    <ul className="alloc">
      {items.map((a, i) => (
        <li key={i} className={a.logged ? 'logged' : ''}>
          <span className={`bar ${a.kind === 'mock' ? 'mock' : a.track ?? ''}`} />
          <span className="t">
            <b>{a.label}</b>
            <small>{[a.section, a.sub].filter(Boolean).join(', ')}</small>
          </span>
          <span className="h">
            <span>{a.hours > 0 ? fmtH(a.hours) : ''}</span>
            {!a.logged && day.status !== 'past' ? (
              <Link className="linkbtn" href={logHref(a, day.date)}>
                Log it
              </Link>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TrackLegend() {
  return (
    <div className="legend">
      <span>
        <i style={{ background: 'var(--math)' }} />
        Maths and aptitude stream
      </span>
      <span>
        <i style={{ background: 'var(--core)' }} />
        Core stream
      </span>
      <span>
        <i style={{ background: 'var(--signal)' }} />
        Mock test
      </span>
    </div>
  );
}

export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
