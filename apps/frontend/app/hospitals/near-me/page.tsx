'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { hospitalApi, NearbyHospital } from '@/lib/api/hospitalApi';
import { patientApi } from '@/lib/api/patientApi';
import { ILLNESS_TYPES } from '@/lib/illnessTypes';
import { TopBar } from '@/components/TopBar';
import { EmergencyButton } from '@/components/EmergencyButton';

export default function NearMeHospitalsPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [illnessType, setIllnessType] = useState('');
  const [hospitals, setHospitals] = useState<NearbyHospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!accessToken) {
      router.push('/');
      return;
    }
    init();
  }, [accessToken]);

  async function init() {
    setError('');
    try {
      const profile = await patientApi.getMe();
      const preferredIllness = profile.illnessType ?? '';
      setIllnessType(preferredIllness);

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          await search(lat, lng, preferredIllness);
        },
        () => {
          setError('Location access is required to find nearby hospitals — allow it and reload.');
          setLoading(false);
        },
      );
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to load');
      setLoading(false);
    }
  }

  async function search(lat: number, lng: number, illness: string) {
    setLoading(true);
    setError('');
    try {
      const data = await hospitalApi.nearby(lat, lng, illness || undefined);
      setHospitals(data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to load nearby hospitals');
    } finally {
      setLoading(false);
    }
  }

  function handleIllnessChange(value: string) {
    setIllnessType(value);
    if (coords) search(coords.lat, coords.lng, value);
  }

  if (!accessToken) return null;

  return (
    <>
      <EmergencyButton />
      <TopBar homeHref="/appointments">
        <Link href="/appointments" className="font-medium" style={{ color: 'var(--muted)' }}>
          My Appointments
        </Link>
      </TopBar>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Hospitals Near You</h1>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="illnessType">
            Looking for care for
          </label>
          <select
            id="illnessType"
            value={illnessType}
            onChange={(e) => handleIllnessChange(e.target.value)}
            className="input"
          >
            <option value="">Any specialty</option>
            {ILLNESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Finding hospitals near you...</p>}
        {error && (
          <p className="text-sm rounded-lg px-3.5 py-2.5" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        {!loading && !error && hospitals.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No verified hospitals found nearby.</p>
        )}

        <ul className="space-y-3">
          {hospitals.map((h) => (
            <li key={h.id} className="card p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{h.name}</p>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {h.address}
                  </p>
                </div>
                <span className="section-label shrink-0">{h.distanceKm} km</span>
              </div>
              <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--muted)' }}>
                <span>
                  <strong style={{ color: h.availableBeds > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {h.availableBeds}
                  </strong>{' '}
                  / {h.totalBeds} beds available
                </span>
                {illnessType && (
                  <span>
                    <strong style={{ color: 'var(--foreground)' }}>{h.matchingDoctors}</strong> matching doctor
                    {h.matchingDoctors === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <Link
                href={illnessType ? `/doctors?specialty=${encodeURIComponent(illnessType)}` : '/doctors'}
                className="btn-secondary w-full text-sm"
              >
                View doctors
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
