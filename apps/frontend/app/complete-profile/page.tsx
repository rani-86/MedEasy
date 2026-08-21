'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { patientApi } from '@/lib/api/patientApi';
import { ILLNESS_TYPES } from '@/lib/illnessTypes';
import { Logo } from '@/components/Logo';

export default function CompleteProfilePage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [age, setAge] = useState('');
  const [illnessType, setIllnessType] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      router.push('/');
      return;
    }
    // Already complete (e.g. the patient navigated here directly) — nothing to do here.
    patientApi.getMe().then((profile) => {
      if (profile.profileComplete) {
        router.push('/appointments');
        return;
      }
      setChecking(false);
    });
  }, [accessToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!age || !illnessType || !email) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    try {
      await patientApi.updateMe({ age: Number(age), illnessType, email });
      router.push('/appointments');
    } catch (err: any) {
      const apiError = err.response?.data?.error;
      setError(apiError?.details?.[0]?.message ?? apiError?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (!accessToken || checking) return null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <div>
            <p className="font-medium">One last step</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              This helps us show you the right specialists and nearby hospitals.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="age">
              Age
            </label>
            <input
              id="age"
              type="number"
              min={0}
              max={130}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="illnessType">
              What are you looking for care for?
            </label>
            <select
              id="illnessType"
              value={illnessType}
              onChange={(e) => setIllnessType(e.target.value)}
              className="input"
            >
              <option value="" disabled>
                Select one
              </option>
              {ILLNESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </div>

        {error && (
          <p className="text-sm rounded-lg px-3.5 py-2.5" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
