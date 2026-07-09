import Link from 'next/link';

export default function Home() {
  return (
    <div className="card">
      <h1>Family Tree</h1>
      <p>A minimal starter for tracking family relationships.</p>
      <Link href="/login">Login →</Link>
    </div>
  );
}
