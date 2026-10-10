import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { logout } from '@/app/actions';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="rail">
        <Link href="/" className="brand">
          <b>GATE RA 27</b>
          <span>Robotics &amp; Automation planner</span>
        </Link>
        <Nav />
        <div className="rail-foot">
          <span>Data lives in your Google Sheet.</span>
          {process.env.APP_PASSWORD ? (
            <form action={logout}>
              <button className="linkbtn" type="submit">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
