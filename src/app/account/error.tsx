'use client';
import Link from 'next/link';
export default function WorkspaceError({ reset }: { reset: () => void }) {
 return <div className="wrap section" role="alert"><h1>Your workspace could not load.</h1><p>Please try again. If your session has expired, sign in again.</p><div className="actions"><button className="button" onClick={reset}>Try again</button><Link className="text-link" href="/sign-in">Sign in again →</Link></div></div>;
}
