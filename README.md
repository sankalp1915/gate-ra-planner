# GATE RA 27 planner

Plans and tracks GATE 2027 Robotics & Automation (RA) preparation for a working schedule: 4 h on weekdays and 9 h on weekends, syllabus from 11 Oct to 31 Dec 2026, revision through January 2027. Data lives in a Google Sheet. Built with Next.js 16 and deploys to Vercel as-is.

## Pages

| Page | What it does |
| --- | --- |
| Today (`/`) | Today's target, hours done, what to study (maths stream + core stream), pace vs the original plan, this week, progress by section |
| Planner | This week day by day, then every syllabus and revision week with the topics it covers |
| Tracker | Log a session (study, PYQs or revision), mark a topic finished, heatmap, session history with delete |
| Syllabus | All 83 topics with estimates you can edit, progress, mark done or reopen, add the optional B1 Electrical topics |
| Revision | January plan by section, mock test log and score trend, day-by-day January schedule |
| Settings | Dates, hours per weekday, how shortfalls are spread, one-off day changes (holidays, late office days) |

## How the plan adapts

* Each week's target is set on Monday: hours still left x (this week's hours / hours left in the phase).
* Inside the week, a short day's gap is spread equally over the remaining days of that week (or by each day's usual hours, if you pick that in Settings). A long day takes load off the rest of the week straight away.
* Whatever is still open on Sunday night is spread over all later weeks.
* Hours count toward a topic up to its estimate. Marking a topic done early credits the rest of its estimate, so the load drops.
* A day you change in Settings (for example 0 h on a travel day) hands its share to the other days.

The engine is in `lib/plan.ts`; `npm run test:plan` runs the checks for these rules.

## Setup

### 1. Google service account (about 5 minutes)

1. Go to <https://console.cloud.google.com/>, create a project (or reuse one).
2. APIs & Services > Library > enable **Google Sheets API**.
3. APIs & Services > Credentials > Create credentials > **Service account**. No roles needed.
4. Open the service account > Keys > Add key > JSON. A `.json` file downloads.
5. Create an empty Google Sheet. Click **Share** and add the service account's `client_email` (from the JSON) as **Editor**.
6. Copy the sheet id from its URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`.

You do not need to create any tabs. On first load the app adds `Topics`, `Logs`, `Settings`, `Overrides` and `Mocks`, and fills in the syllabus and default settings.

### 2. Run locally

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev                  # http://localhost:3000
```

### 3. Deploy to Vercel

1. Push this folder to a GitHub repo and import it at <https://vercel.com/new> (framework is detected as Next.js), or run `npx vercel` in the folder.
2. In Project > Settings > Environment Variables add:

| Variable | Value |
| --- | --- |
| `GOOGLE_SHEET_ID` | the sheet id |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | the whole JSON key file pasted as-is (easiest), **or** use the two below |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON |
| `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON, including the BEGIN/END lines |
| `APP_PASSWORD` | a password for the site; leave unset to disable the login |
| `APP_TIMEZONE` | `Asia/Kolkata` (Vercel runs in UTC, this decides what "today" is) |

3. Redeploy. Set `APP_PASSWORD`: anyone with the URL could otherwise edit your sheet through the site.

## The sheet

You can edit the tabs by hand; the site reads them on every page load.

* **Topics**: `id, section, subject, topic, track (math|core), est_hours, order, active, done_on, notes`. `order` is the study order within a track. Keep `id` stable; logs point at it.
* **Logs**: `id, date, topic_id, hours, type (study|pyq|revision|mock), note, created_at`. `topic_id` can also be `section:<Section name>` for whole-section revision.
* **Settings**: key/value pairs (dates, `hours_mon` … `hours_sun`, `redistribution`, `math_share`, `revision_load`, `mock_hours`).
* **Overrides**: `date, hours, reason` for one-off days.
* **Mocks**: `id, date, name, score, max_marks, hours, notes`.

## Notes

* Syllabus follows the published GATE 2027 RA syllabus (IIT Madras): GA 15 marks, Part A 60 (Engineering Mathematics, Basics of Mechatronics, Principles of Robotics & Automation) and Part B 25 (B1 Electrical or B2 Mechanical, chosen in the exam). B2 is on by default; B1 topics are in the sheet and switched off. Check against the official PDF at gate2027.iitm.ac.in.
* Hour estimates are a starting point for a mechanical graduate. Adjust them on the Syllabus page after the first couple of weeks.
* GATE 2027 is scheduled for 6, 7, 13, 14, 20 and 21 Feb 2027. Set your RA slot in Settings when it is announced.
