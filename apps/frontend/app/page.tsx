'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/authStore';

export default function LoginPage() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const accessToken = useAuthStore((s) => s.accessToken);

  async function requestOtp() {
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/otp/request', { phone });
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
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (accessToken) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-green-600 font-medium">Logged in successfully</p>
          <Link href="/appointments" className="inline-block bg-black text-white rounded px-4 py-2">
            Go to My Appointments
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-center">Medeasy — Patient Login</h1>

        {step === 'phone' && (
          <>
            <input
              type="tel"
              placeholder="+919000000001"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
            <button
              onClick={requestOtp}
              disabled={loading}
              className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        )}

        {step === 'otp' && (
          <>
            <p className="text-sm text-gray-500">Check your backend terminal for the dev-mode OTP.</p>
            <input
              type="text"
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
            <button
              onClick={verifyOtp}
              disabled={loading}
              className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    </main>
  );
}