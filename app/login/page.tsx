import { login } from '@/app/actions';
import { Submit } from '@/components/Submit';
import { one, type SP } from '@/lib/load';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = one(sp.next) || '/';
  return (
    <div className="login">
      <form action={login} className="panel">
        <div className="brand">
          <b>GATE RA 27</b>
          <span>Robotics &amp; Automation planner</span>
        </div>
        <input type="hidden" name="next" value={next} />
        <label className="field">
          Password
          <input type="password" name="password" autoComplete="current-password" required autoFocus />
        </label>
        {one(sp.error) ? <p className="down small">That password is not right. Try again.</p> : null}
        <Submit pending="Signing in…">Sign in</Submit>
      </form>
    </div>
  );
}
