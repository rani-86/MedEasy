'use client';

import { useState } from 'react';
import Link from 'next/link';
import { hospitalApi } from '@/lib/api/hospitalApi';
import { Logo } from '@/components/Logo';

export default function HospitalRegisterPage() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locating, setLocating] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function useCurrentLocation() {
    setError('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
        setLocating(false);
      },
      () => {
        setError('Could not get your location — enter coordinates manually instead.');
        setLocating(false);
      },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!latitude || !longitude) {
      setError('Set the hospital location first');
      return;
    }
    setLoading(true);
    try {
      await hospitalApi.register({
        name,
        address,
        registrationId,
        latitude: Number(latitude),
        longitude: Number(longitude),
        adminName,
        adminEmail,
        adminPassword,
      });
      setDone(true);
    } catch (err: any) {
      const apiError = err.response?.data?.error;
      setError(apiError?.details?.[0]?.message ?? apiError?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card w-full max-w-sm p-8 text-center space-y-4">
          <Logo size="lg" />
          <p className="badge badge-warning">Pending verification</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Your hospital is registered but not yet verified — until it is, your admin account
            can only view onboarding status. Next, set up your authenticator app.
          </p>
          <Link href="/admin/mfa-setup" className="btn-primary w-full">
            Set up MFA
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Register your hospital
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="name">
              Hospital name
            </label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="address">
              Address
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="registrationId">
              Hospital registration ID
            </label>
            <input
              id="registrationId"
              type="text"
              placeholder="e.g. APEX-HOSP-001"
              value={registrationId}
              onChange={(e) => setRegistrationId(e.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Location</label>
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locating}
                className="text-xs font-medium"
                style={{ color: 'var(--brand)' }}
              >
                {locating ? 'Locating...' : 'Use my current location'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                placeholder="Latitude"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="input"
              />
              <input
                type="number"
                step="any"
                placeholder="Longitude"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <hr style={{ borderColor: 'var(--border)' }} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="adminName">
              Your name (hospital admin)
            </label>
            <input
              id="adminName"
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="adminEmail">
              Admin email
            </label>
            <input
              id="adminEmail"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="input"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="adminPassword">
              Admin password
            </label>
            <input
              id="adminPassword"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="input"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Registering...' : 'Register hospital'}
          </button>
        </div>

        {error && (
          <p className="text-sm rounded-lg px-3.5 py-2.5" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
          Already registered?{' '}
          <Link href="/admin/login" className="font-medium" style={{ color: 'var(--brand)' }}>
            Log in here
          </Link>
        </p>
      </form>
    </main>
  );
}
