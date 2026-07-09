'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Person = {
  id: string;
  name: string;
  gender: string | null;
  birth_date: string | null;
  mother_name: string | null;
  father_name: string | null;
};

export default function Dashboard() {
  const router = useRouter();
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('ft_token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/persons`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then((data) => setPersons(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  function logout() {
    localStorage.removeItem('ft_token');
    router.push('/login');
  }

  return (
    <div className="card">
      <h1>Family Tree</h1>
      {loading && <p>Loading…</p>}
      {error && <div className="error">{error}</div>}
      <ul>
        {persons.map((p) => (
          <li key={p.id}>
            <strong>{p.name}</strong> ({p.gender || '?'})
            {p.mother_name && ` — mother: ${p.mother_name}`}
            {p.father_name && `, father: ${p.father_name}`}
          </li>
        ))}
      </ul>
      <button onClick={logout} style={{ background: '#6b7280', marginTop: 16 }}>
        Logout
      </button>
    </div>
  );
}
