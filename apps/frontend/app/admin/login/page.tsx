'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { Logo } from '@/components/Logo';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const accessToken = useAuthStore((s) => s.accessToken);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login/admin', { email, password, totpCode });
      setAccessToken(res.data.data.accessToken);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (accessToken) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card w-full max-w-sm p-8 text-center space-y-5">
          <Logo size="lg" />
          <p className="badge badge-success">Logged in</p>
          <Link href="/admin/beds" className="btn-primary w-full">
            Go to Bed Management
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleLogin} className="card w-full max-w-sm p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Admin login
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@hospital.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="totp">
              Authenticator code
            </label>
            <input
              id="totp"
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="input"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </div>

        {error && (
          <p className="text-sm rounded-lg px-3.5 py-2.5" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
          Haven&apos;t set up an authenticator yet?{' '}
          <Link href="/admin/mfa-setup" className="font-medium" style={{ color: 'var(--brand)' }}>
            Set up MFA
          </Link>
        </p>
        <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
          New hospital?{' '}
          <Link href="/hospital/register" className="font-medium" style={{ color: 'var(--brand)' }}>
            Register here
          </Link>
        </p>
      </form>
    </main>
  );
}
