'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { appointmentApi, QueueAppointment } from '@/lib/api/appointmentApi';
import { createQueueSocket } from '@/lib/socket';

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

  if (!accessToken) return null;

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Today&apos;s Queue</h1>
        <span className="flex items-center gap-2 text-sm text-gray-500">
          <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!loading && !error && queue.length === 0 && (
        <p className="text-sm text-gray-500">No booked appointments remaining today.</p>
      )}

      <ul className="space-y-2">
        {queue.map((a, i) => (
          <li key={a.id} className="border rounded p-3 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">{a.patientName}</p>
              <p className="text-xs text-gray-500">{new Date(a.slotStart).toLocaleTimeString()}</p>
            </div>
            <span className="text-xs text-gray-500">#{i + 1} in queue</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
