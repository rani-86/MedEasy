'use client';

import { useState } from 'react';
import { emergencyApi, EmergencyCreated } from '@/lib/api/emergencyApi';

type Stage = 'idle' | 'confirming' | 'sending' | 'sent' | 'error';

export function EmergencyButton() {
  const [stage, setStage] = useState<Stage>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<EmergencyCreated | null>(null);
  const [error, setError] = useState('');

  function startConfirm() {
    setError('');
    setStage('confirming');
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setError('Could not get your location — location access is required to send an alert.');
        setStage('error');
      },
    );
  }

  async function confirmSend() {
    if (!coords) return;
    setStage('sending');
    setError('');
    try {
      const created = await emergencyApi.create(coords.lat, coords.lng);
      setResult(created);
      setStage('sent');
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Could not send the alert — try again.');
      setStage('error');
    }
  }

  function reset() {
    setStage('idle');
    setCoords(null);
    setResult(null);
    setError('');
  }

  if (stage === 'idle') {
    return (
      <button
        onClick={startConfirm}
        className="fixed bottom-5 right-5 z-50 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg"
        style={{ background: 'var(--danger)' }}
      >
        🚨 Emergency
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 card p-4 w-72 space-y-3"
      style={{ borderColor: 'var(--danger)' }}
    >
      {stage === 'confirming' && (
        <>
          <p className="text-sm font-medium">Send an emergency alert?</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {coords ? 'Your location is ready.' : 'Getting your location...'} This notifies the
            nearest verified hospital immediately.
          </p>
          <div className="flex gap-2">
            <button onClick={confirmSend} disabled={!coords} className="btn-danger flex-1 text-sm">
              Confirm
            </button>
            <button onClick={reset} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </>
      )}

      {stage === 'sending' && <p className="text-sm">Sending alert...</p>}

      {stage === 'sent' && result && (
        <>
          <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>
            Alert sent
          </p>
          <p className="text-sm">
            {result.hospitalName} has been notified — {result.distanceKm} km away.
          </p>
          <button onClick={reset} className="btn-secondary w-full text-sm">
            Close
          </button>
        </>
      )}

      {stage === 'error' && (
        <>
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
          <button onClick={reset} className="btn-secondary w-full text-sm">
            Close
          </button>
        </>
      )}
    </div>
  );
}
