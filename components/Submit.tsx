'use client';
import { useFormStatus } from 'react-dom';

export function Submit({
  children,
  pending = 'Saving…',
  className = 'btn',
  confirm,
}: {
  children: React.ReactNode;
  pending?: string;
  className?: string;
  confirm?: string;
}) {
  const { pending: busy } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={busy}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {busy ? pending : children}
    </button>
  );
}
