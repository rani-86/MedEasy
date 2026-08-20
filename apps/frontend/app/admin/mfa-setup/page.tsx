'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { Logo } from '@/components/Logo';

export default function AdminMfaSetupPage() {
  const [step, setStep] = useState<'credentials' | 'confirm' | 'done'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestSecret(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/admin/mfa/setup-request', { email, password });
      setSecret(res.data.data.secret);
      setOtpauthUrl(res.data.data.otpauthUrl);
      setStep('confirm');
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function confirmSecret(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/admin/mfa/setup-confirm', { email, password, totpCode });
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Set up admin MFA
          </p>
        </div>

        {step === 'credentials' && (
          <form onSubmit={requestSecret} className="space-y-3">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Enter your existing email and password to generate a new authenticator secret.
            </p>
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
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Generating...' : 'Generate secret'}
            </button>
          </form>
        )}

        {step === 'confirm' && (
          <form onSubmit={confirmSecret} className="space-y-3">
            <div className="space-y-2 text-sm rounded-lg px-3.5 py-3" style={{ background: 'var(--brand-soft)' }}>
              <p style={{ color: 'var(--brand-dark)' }}>
                Add this to your authenticator app (Google Authenticator, Authy, etc.) using &quot;enter a setup key&quot;
                manually — there&apos;s no QR scanner here, just the key itself:
              </p>
              <p className="font-mono text-xs break-all rounded px-2 py-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {secret}
              </p>
              <details>
                <summary className="text-xs cursor-pointer" style={{ color: 'var(--brand-dark)' }}>
                  Show otpauth URL instead
                </summary>
                <p className="font-mono text-xs break-all mt-1">{otpauthUrl}</p>
              </details>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="totp">
                Enter the 6-digit code it generates
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
              {loading ? 'Confirming...' : 'Confirm & activate'}
            </button>
            <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
              This code expires in 10 minutes. If it does, just start over.
            </p>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4">
            <p className="badge badge-success">MFA activated</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              You can now log in with your email, password, and authenticator code.
            </p>
            <Link href="/admin/login" className="btn-primary w-full">
              Go to admin login
            </Link>
          </div>
        )}

        {error && (
          <p className="text-sm rounded-lg px-3.5 py-2.5" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
