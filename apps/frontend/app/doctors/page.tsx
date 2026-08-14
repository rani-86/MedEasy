'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { doctorApi, Doctor } from '@/lib/api/doctorApi';

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
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Find a Doctor</h1>
        <Link href="/appointments" className="text-sm text-gray-500 hover:underline">
          My Appointments
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or specialty"
          className="flex-1 border rounded px-3 py-2"
        />
        <button type="submit" className="bg-black text-white rounded px-4 py-2">
          Search
        </button>
      </form>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!loading && !error && doctors.length === 0 && (
        <p className="text-sm text-gray-500">No doctors found.</p>
      )}

      <ul className="space-y-3">
        {doctors.map((doctor) => (
          <li key={doctor.id} className="border rounded p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{doctor.name}</p>
              <p className="text-sm text-gray-500">
                {doctor.specialty} &middot; {doctor.hospitalName}
              </p>
            </div>
            <Link
              href={`/appointments?doctorId=${doctor.id}`}
              className="bg-black text-white rounded px-3 py-2 text-sm"
            >
              Book
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
