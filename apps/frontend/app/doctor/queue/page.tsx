'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { appointmentApi, QueueAppointment } from '@/lib/api/appointmentApi';
import { createQueueSocket } from '@/lib/socket';
import { TopBar } from '@/components/TopBar';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DoctorQueuePage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [queue, setQueue] = useState<QueueAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      router.push('/doctor/login');
      return;
    }

    loadQueue();

    const socket = createQueueSocket(accessToken);
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('queue:updated', () => {
      loadQueue();
    });
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [accessToken]);

  async function loadQueue() {
    setError('');
    try {
      const data = await appointmentApi.listForDoctorQueue(todayUtc());
      setQueue(data.filter((a) => a.status === 'booked'));
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(id: string) {
    setCompletingId(id);
    setError('');
    try {
      await appointmentApi.complete(id);
      // The socket 'queue:updated' event will also trigger a reload, but this keeps
      // the UI responsive immediately instead of waiting on the round trip.
      await loadQueue();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Could not mark this appointment complete');
    } finally {
      setCompletingId(null);
    }
  }

  if (!accessToken) return null;

  return (
    <>
      <TopBar homeHref="/doctor/queue">
        <span className="flex items-center gap-2 text-sm font-medium" style={{ color: connected ? 'var(--success)' : 'var(--muted)' }}>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: connected ? 'var(--success)' : 'var(--muted)' }}
          />
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </TopBar>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Today&apos;s Queue</h1>
          <span className="section-label">{queue.length} waiting</span>
        </div>

        {loading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>}
        {error && (
          <p className="text-sm rounded-lg px-3.5 py-2.5" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        {!loading && !error && queue.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No booked appointments remaining today.</p>
        )}

        <ul className="space-y-2">
          {queue.map((a, i) => (
            <li key={a.id} className="card p-4 flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                  style={{ background: 'var(--brand-soft)', color: 'var(--brand-dark)' }}
                >
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-medium">{a.patientName}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {new Date(a.slotStart).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleComplete(a.id)}
                disabled={completingId === a.id}
                className="btn-secondary shrink-0 text-xs px-3 py-1.5"
              >
                {completingId === a.id ? 'Marking...' : 'Mark complete'}
              </button>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
