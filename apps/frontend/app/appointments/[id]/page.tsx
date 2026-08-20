'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { appointmentApi, Appointment } from '@/lib/api/appointmentApi';
import { doctorApi, Doctor } from '@/lib/api/doctorApi';
import { TopBar } from '@/components/TopBar';
import { StatusBadge } from '@/components/StatusBadge';

export default function AppointmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [actionError, setActionError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [newSlotStart, setNewSlotStart] = useState('');

  useEffect(() => {
    if (!accessToken) {
      router.push('/');
      return;
    }
    load();
  }, [accessToken, params.id]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const appt = await appointmentApi.getById(params.id);
      setAppointment(appt);
      const doc = await doctorApi.getById(appt.doctorId);
      setDoctor(doc);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to load appointment');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    setActionError('');
    setCancelling(true);
    try {
      await appointmentApi.cancel(params.id);
      await load();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message ?? 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  }

  async function handleReschedule() {
    setActionError('');
    if (!newSlotStart) {
      setActionError('Pick a new date and time first');
      return;
    }
    setRescheduling(true);
    try {
      const isoSlotStart = new Date(newSlotStart).toISOString();
      const updated = await appointmentApi.reschedule(params.id, isoSlotStart);
      router.push(`/appointments/${updated.id}`);
    } catch (err: any) {
      const apiError = err.response?.data?.error;
      setActionError(apiError?.details?.[0]?.message ?? apiError?.message ?? 'Reschedule failed');
    } finally {
      setRescheduling(false);
    }
  }

  if (!accessToken) return null;

  return (
    <>
      <TopBar homeHref="/appointments">
        <Link href="/appointments" className="font-medium" style={{ color: 'var(--muted)' }}>
          Back to My Appointments
        </Link>
      </TopBar>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Appointment Details</h1>

        {loading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>}
        {error && (
          <p className="text-sm rounded-lg px-3.5 py-2.5" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        {appointment && (
          <section className="card p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{doctor?.name ?? 'Unknown doctor'}</p>
                {doctor && (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {doctor.specialty} &middot; {doctor.hospitalName}
                  </p>
                )}
              </div>
              <StatusBadge status={appointment.status} />
            </div>
            <div style={{ borderTop: '1px solid var(--border)' }} className="pt-3 space-y-1">
              <p className="text-sm">
                <span style={{ color: 'var(--muted)' }}>When:</span>{' '}
                {new Date(appointment.slotStart).toLocaleString()} &ndash;{' '}
                {new Date(appointment.slotEnd).toLocaleTimeString()}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Booked on {new Date(appointment.createdAt).toLocaleString()}
              </p>
            </div>
          </section>
        )}

        {appointment?.status === 'booked' && (
          <section className="card p-5 space-y-3">
            <h2 className="font-medium">Manage this appointment</h2>
            {actionError && (
              <p className="text-sm rounded-lg px-3.5 py-2.5" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                {actionError}
              </p>
            )}

            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={newSlotStart}
                onChange={(e) => setNewSlotStart(e.target.value)}
                className="input flex-1"
              />
              <button onClick={handleReschedule} disabled={rescheduling} className="btn-primary shrink-0">
                {rescheduling ? 'Rescheduling...' : 'Reschedule'}
              </button>
            </div>

            <button onClick={handleCancel} disabled={cancelling} className="btn-danger w-full">
              {cancelling ? 'Cancelling...' : 'Cancel Appointment'}
            </button>
          </section>
        )}
      </main>
    </>
  );
}
