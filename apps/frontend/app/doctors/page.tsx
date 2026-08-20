'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { doctorApi, Doctor } from '@/lib/api/doctorApi';
import { TopBar } from '@/components/TopBar';

export default function DoctorsPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!accessToken) {
      router.push('/');
      return;
    }
    loadDoctors();
  }, [accessToken]);

  async function loadDoctors(searchTerm?: string) {
    setLoading(true);
    setError('');
    try {
      const result = await doctorApi.list(searchTerm);
      setDoctors(result.data);
    } catch (err: any) {
      const apiError = err.response?.data?.error;
      setError(apiError?.details?.[0]?.message ?? apiError?.message ?? 'Failed to load doctors');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadDoctors(search.trim() || undefined);
  }

  if (!accessToken) return null;

  return (
    <>
      <TopBar homeHref="/appointments">
        <Link href="/appointments" className="font-medium" style={{ color: 'var(--muted)' }}>
          My Appointments
        </Link>
      </TopBar>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Find a Doctor</h1>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or specialty"
            className="input flex-1"
          />
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>

        {loading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>}
        {error && (
          <p className="text-sm rounded-lg px-3.5 py-2.5" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        {!loading && !error && doctors.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No doctors found.</p>
        )}

        <ul className="space-y-3">
          {doctors.map((doctor) => (
            <li key={doctor.id} className="card p-4 flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-semibold shrink-0"
                  style={{ background: 'var(--brand-soft)', color: 'var(--brand-dark)' }}
                >
                  {doctor.name
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{doctor.name}</p>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {doctor.specialty} &middot; {doctor.hospitalName}
                  </p>
                </div>
              </div>
              <Link href={`/appointments?doctorId=${doctor.id}`} className="btn-primary shrink-0">
                Book
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
