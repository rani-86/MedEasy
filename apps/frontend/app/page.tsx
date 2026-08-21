'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { patientApi } from '@/lib/api/patientApi';
import { Logo } from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const accessToken = useAuthStore((s) => s.accessToken);

  async function requestOtp() {
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/otp/request', { phone });
      setDemoOtp(res.data.data.demoOtp ?? null);
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/otp/verify', { phone, otp });
      setAccessToken(res.data.data.accessToken);
      const profile = await patientApi.getMe();
      router.push(profile.profileComplete ? '/appointments' : '/complete-profile');
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
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Patient login
          </p>
        </div>

        {step === 'phone' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="phone">
                Mobile number
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+919000000001"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
              />
            </div>
            <button onClick={requestOtp} disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-3">
            {demoOtp ? (
              <p className="text-sm rounded-lg px-3.5 py-2.5" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                Demo mode — no SMS provider is configured, so here&apos;s your code: <strong>{demoOtp}</strong>
              </p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Check your backend terminal for the dev-mode OTP.
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="otp">
                6-digit code
              </label>
              <input
                id="otp"
                type="text"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="input"
              />
            </div>
            <button onClick={verifyOtp} disabled={loading} className="btn-primary w-full">
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm rounded-lg px-3.5 py-2.5" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
          Doctor?{' '}
          <Link href="/doctor/login" className="font-medium" style={{ color: 'var(--brand)' }}>
            Log in here
          </Link>
        </p>
      </div>
    </main>
  );
}
