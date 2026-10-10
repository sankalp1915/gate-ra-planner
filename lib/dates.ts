const DAY = 86_400_000;

export const isISODate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

const toMs = (s: string) => Date.parse(s + 'T00:00:00Z');
const fromMs = (t: number) => new Date(t).toISOString().slice(0, 10);

export const addDays = (s: string, n: number) => fromMs(toMs(s) + n * DAY);
/** 0 = Sunday ... 6 = Saturday */
export const dow = (s: string) => new Date(toMs(s)).getUTCDay();
export const diffDays = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);
export const mondayOf = (s: string) => addDays(s, -((dow(s) + 6) % 7));
export const isWeekend = (s: string) => dow(s) === 0 || dow(s) === 6;

export function range(a: string, b: string): string[] {
  const out: string[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
}

export function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export const appToday = () => todayIn(process.env.APP_TIMEZONE || 'Asia/Kolkata');

const fmt = (s: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', ...o }).format(new Date(toMs(s)));

export const fmtLong = (s: string) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtShort = (s: string) => fmt(s, { day: 'numeric', month: 'short' });
export const fmtDow = (s: string) => fmt(s, { weekday: 'short' });
export const fmtDayMonth = (s: string) => fmt(s, { weekday: 'short', day: 'numeric', month: 'short' });

export const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
