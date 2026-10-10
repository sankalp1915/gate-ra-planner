import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="login">
      <div className="panel">
        <h1>Page not found</h1>
        <Link className="btn" href="/">
          Go to today
        </Link>
      </div>
    </div>
  );
}
