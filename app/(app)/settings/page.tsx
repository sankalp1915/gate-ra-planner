import { deleteOverride, saveOverride, updateSettings } from '@/app/actions';
import { Submit } from '@/components/Submit';
import { Flash, PageHead, SetupNotice } from '@/components/ui';
import { DOW_NAMES, fmtDayMonth } from '@/lib/dates';
import { getPageData, one, type SP } from '@/lib/load';
import { fmtHn } from '@/lib/plan';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const data = await getPageData();
  if (!data.ok) return <SetupNotice error={data.error} config={data.config} />;
  const { store, plan, today } = data;
  const s = store.settings;
  const weekly = s.hours.reduce((a, b) => a + b, 0);
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const overrides = store.overrides.slice().sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <>
      <Flash msg={one(sp.msg)} />
      <PageHead title="Settings">
        Your usual week is {fmtHn(weekly)} h. That gives {fmtHn(plan.syllabus.capTotal)} h for the syllabus and{' '}
        {fmtHn(plan.revision.capTotal)} h in January.
      </PageHead>

      <form action={updateSettings} className="stack">
        <section className="panel grid">
          <h2>Timeline</h2>
          <div className="grid cols-4">
            <label className="field">
              Start studying
              <input type="date" name="startDate" defaultValue={s.startDate} required />
            </label>
            <label className="field">
              Finish syllabus by
              <input type="date" name="syllabusEnd" defaultValue={s.syllabusEnd} required />
            </label>
            <label className="field">
              Revision starts
              <input type="date" name="revisionStart" defaultValue={s.revisionStart} required />
            </label>
            <label className="field">
              Revision ends
              <input type="date" name="revisionEnd" defaultValue={s.revisionEnd} required />
            </label>
            <label className="field">
              Exam day
              <input type="date" name="examDate" defaultValue={s.examDate} required />
              <span className="hint">GATE 2027 runs 6, 7, 13, 14, 20 and 21 Feb. Set your RA slot once it is announced.</span>
            </label>
          </div>
        </section>

        <section className="panel grid">
          <h2>Study hours in a normal week</h2>
          <p className="muted small">Office runs about 10 am to 10 pm on weekdays, so 4 h on weekdays and 9 h on weekends to start.</p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
            {ORDER.map((i) => (
              <label key={i} className="field">
                {DOW_NAMES[i]}
                <input type="number" name={`h${i}`} min="0" max="16" step="0.5" defaultValue={s.hours[i]} required />
              </label>
            ))}
          </div>
        </section>

        <section className="panel grid">
          <h2>How the plan adapts</h2>
          <fieldset className="grid" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field" style={{ marginBottom: '0.4rem', fontWeight: 560 }}>
              When a day goes over or under target
            </legend>
            <label className="check">
              <input type="radio" name="mode" value="uniform" defaultChecked={s.mode === 'uniform'} />
              Spread the difference equally across the rest of the week
            </label>
            <label className="check">
              <input type="radio" name="mode" value="proportional" defaultChecked={s.mode === 'proportional'} />
              Spread it by each day’s usual hours, so weekends absorb more
            </label>
          </fieldset>
          <div className="grid cols-4">
            <label className="field">
              Maths and aptitude share
              <select name="mathShare" defaultValue={s.mathShare === 'auto' ? 'auto' : String(Math.round(s.mathShare * 100))}>
                <option value="auto">Automatic (both streams finish together)</option>
                {[20, 25, 30, 35, 40, 50].map((v) => (
                  <option key={v} value={v}>
                    {v}% of each day
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              January load
              <input type="number" name="revisionLoad" min="10" max="100" step="5" defaultValue={Math.round(s.revisionLoad * 100)} />
              <span className="hint">% of January hours planned; the rest is buffer</span>
            </label>
            <label className="field">
              Mock block on revision weekends
              <input type="number" name="mockHours" min="0" max="12" step="0.5" defaultValue={s.mockHours} />
              <span className="hint">hours; 3 h test + 2 h analysis</span>
            </label>
          </div>
        </section>
        <div>
          <Submit pending="Saving…">Save settings</Submit>
        </div>
      </form>

      <section className="section grid cols-2">
        <div className="panel">
          <h2 style={{ marginBottom: '0.4rem' }}>Change one day</h2>
          <p className="muted small" style={{ marginBottom: '1rem' }}>
            A late office day, a holiday, a trip. Set the hours you really have; that day’s share moves to other days.
          </p>
          <form action={saveOverride} className="stack">
            <input type="hidden" name="back" value="/settings" />
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Date
                <input type="date" name="date" defaultValue={today} required />
              </label>
              <label className="field">
                Hours available
                <input type="number" name="hours" min="0" max="16" step="0.5" defaultValue={0} required />
              </label>
            </div>
            <label className="field">
              Reason <span className="hint">optional</span>
              <input type="text" name="reason" maxLength={120} placeholder="e.g. Diwali, product launch week" />
            </label>
            <div>
              <Submit pending="Saving…">Save day</Submit>
            </div>
          </form>
        </div>
        <div className="panel">
          <h2 style={{ marginBottom: '0.75rem' }}>Changed days</h2>
          {overrides.length === 0 ? (
            <p className="muted">Every day uses your normal week.</p>
          ) : (
            <table>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.date}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDayMonth(o.date)}</td>
                    <td className="r">{fmtHn(o.hours)} h</td>
                    <td className="muted small">{o.reason}</td>
                    <td className="r">
                      <form action={deleteOverride}>
                        <input type="hidden" name="date" value={o.date} />
                        <input type="hidden" name="back" value="/settings" />
                        <Submit className="linkbtn" pending="…">
                          Remove
                        </Submit>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="section panel grid" style={{ maxWidth: '70ch' }}>
        <h2>Data</h2>
        <p className="muted">
          Everything is stored in your Google Sheet in five tabs: Topics, Logs, Settings, Overrides and Mocks. You can edit
          them directly; the site reads the sheet on every page load. Today is {fmtDayMonth(today)} in{' '}
          {process.env.APP_TIMEZONE || 'Asia/Kolkata'}.
        </p>
        {sheetId ? (
          <p>
            <a href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`} target="_blank" rel="noreferrer">
              Open the Google Sheet
            </a>
          </p>
        ) : null}
      </section>
    </>
  );
}
