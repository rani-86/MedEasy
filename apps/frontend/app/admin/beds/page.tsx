'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { bedApi, Bed } from '@/lib/api/bedApi';
import { patientApi, PatientProfile } from '@/lib/api/patientApi';
import { createBedsSocket } from '@/lib/socket';
import { TopBar } from '@/components/TopBar';

const STATUS_BADGE: Record<Bed['status'], string> = {
  vacant: 'badge-success',
  occupied: 'badge-danger',
  reserved: 'badge-warning',
  cleaning: 'badge-neutral',
};

export default function AdminBedsPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const [admittingBedId, setAdmittingBedId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [foundPatient, setFoundPatient] = useState<PatientProfile | null>(null);
  const [admitError, setAdmitError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      router.push('/admin/login');
      return;
    }
    load();

    const socket = createBedsSocket(accessToken);
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('bed:status_changed', () => load());
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [accessToken]);

  async function load() {
    setError('');
    try {
      const data = await bedApi.list();
      setBeds(data);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ??
          'Failed to load beds — your hospital may not be verified yet.',
      );
    } finally {
      setLoading(false);
    }
  }

  function startAdmit(bedId: string) {
    setAdmittingBedId(bedId);
    setPhone('');
    setFoundPatient(null);
    setAdmitError('');
  }

  function cancelAdmit() {
    setAdmittingBedId(null);
    setFoundPatient(null);
    setAdmitError('');
  }

  async function handleLookup() {
    setAdmitError('');
    setBusy(true);
    try {
      const patient = await patientApi.lookupByPhone(phone);
      setFoundPatient(patient);
    } catch (err: any) {
      setAdmitError(err.response?.data?.error?.message ?? 'Patient not found');
      setFoundPatient(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmAdmit() {
    if (!admittingBedId || !foundPatient) return;
    setBusy(true);
    setAdmitError('');
    try {
      await bedApi.allocate(admittingBedId, foundPatient.id);
      cancelAdmit();
      await load();
    } catch (err: any) {
      setAdmitError(err.response?.data?.error?.message ?? 'Could not admit this patient');
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(bed: Bed, action: 'reserve' | 'cancelReservation' | 'discharge' | 'markCleaned') {
    setError('');
    try {
      await bedApi[action](bed.id);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Action failed');
    }
  }

  if (!accessToken) return null;

  const byCategory = beds.reduce<Record<string, Bed[]>>((acc, bed) => {
    (acc[bed.category] ??= []).push(bed);
    return acc;
  }, {});

  return (
    <>
      <TopBar homeHref="/admin/beds">
        <span
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: connected ? 'var(--success)' : 'var(--muted)' }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: connected ? 'var(--success)' : 'var(--muted)' }}
          />
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </TopBar>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Bed Management</h1>

        {loading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>}
        {error && (
          <p className="text-sm rounded-lg px-3.5 py-2.5" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        {!loading && !error && beds.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No beds registered for your hospital yet.</p>
        )}

        {Object.entries(byCategory).map(([category, categoryBeds]) => (
          <section key={category} className="space-y-2">
            <h2 className="font-medium capitalize">{category}</h2>
            <ul className="space-y-2">
              {categoryBeds.map((bed) => (
                <li key={bed.id} className="card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{bed.bedNumber}</span>
                    <span className={`badge ${STATUS_BADGE[bed.status]}`}>{bed.status}</span>
                  </div>

                  {admittingBedId === bed.id ? (
                    <div className="space-y-2 rounded-lg p-3" style={{ background: 'var(--brand-soft)' }}>
                      {!foundPatient ? (
                        <>
                          <input
                            type="tel"
                            placeholder="+919000000001"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="input text-sm"
                          />
                          <div className="flex gap-2">
                            <button onClick={handleLookup} disabled={busy} className="btn-primary flex-1 text-sm">
                              {busy ? 'Looking up...' : 'Find patient'}
                            </button>
                            <button onClick={cancelAdmit} className="btn-secondary text-sm">
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm">
                            <strong>{foundPatient.name}</strong>
                            {foundPatient.age ? ` · ${foundPatient.age}y` : ''}
                            {foundPatient.illnessType ? ` · ${foundPatient.illnessType}` : ''}
                          </p>
                          <div className="flex gap-2">
                            <button onClick={handleConfirmAdmit} disabled={busy} className="btn-primary flex-1 text-sm">
                              {busy ? 'Admitting...' : 'Confirm admit'}
                            </button>
                            <button onClick={cancelAdmit} className="btn-secondary text-sm">
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                      {admitError && (
                        <p className="text-xs" style={{ color: 'var(--danger)' }}>
                          {admitError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {bed.status === 'vacant' && (
                        <>
                          <button onClick={() => startAdmit(bed.id)} className="btn-primary text-xs px-3 py-1.5">
                            Admit patient
                          </button>
                          <button onClick={() => handleAction(bed, 'reserve')} className="btn-secondary text-xs px-3 py-1.5">
                            Reserve
                          </button>
                        </>
                      )}
                      {bed.status === 'reserved' && (
                        <>
                          <button onClick={() => startAdmit(bed.id)} className="btn-primary text-xs px-3 py-1.5">
                            Admit patient
                          </button>
                          <button
                            onClick={() => handleAction(bed, 'cancelReservation')}
                            className="btn-secondary text-xs px-3 py-1.5"
                          >
                            Cancel reservation
                          </button>
                        </>
                      )}
                      {bed.status === 'occupied' && (
                        <button onClick={() => handleAction(bed, 'discharge')} className="btn-danger text-xs px-3 py-1.5">
                          Discharge
                        </button>
                      )}
                      {bed.status === 'cleaning' && (
                        <button onClick={() => handleAction(bed, 'markCleaned')} className="btn-secondary text-xs px-3 py-1.5">
                          Mark cleaned
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
