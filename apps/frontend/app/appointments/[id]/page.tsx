'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { appointmentApi, Appointment } from '@/lib/api/appointmentApi';
import { doctorApi, Doctor } from '@/lib/api/doctorApi';

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
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Appointment Details</h1>
        <Link href="/appointments" className="text-sm text-gray-500 hover:underline">
          Back to My Appointments
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {appointment && (
        <section className="border rounded p-4 space-y-2">
          <p className="font-medium">{doctor?.name ?? 'Unknown doctor'}</p>
          {doctor && (
            <p className="text-sm text-gray-500">
              {doctor.specialty} &middot; {doctor.hospitalName}
            </p>
          )}
          <p className="text-sm">
            When: {new Date(appointment.slotStart).toLocaleString()} &ndash;{' '}
            {new Date(appointment.slotEnd).toLocaleTimeString()}
          </p>
          <p className="text-sm">Status: {appointment.status}</p>
          <p className="text-xs text-gray-500">
            Booked on {new Date(appointment.createdAt).toLocaleString()}
          </p>
        </section>
      )}

      {appointment?.status === 'booked' && (
        <section className="border rounded p-4 space-y-3">
          <h2 className="font-medium">Manage this appointment</h2>
          {actionError && <p className="text-red-600 text-sm">{actionError}</p>}

          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={newSlotStart}
              onChange={(e) => setNewSlotStart(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
            />
            <button
              onClick={handleReschedule}
              disabled={rescheduling}
              className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
            >
              {rescheduling ? 'Rescheduling...' : 'Reschedule'}
            </button>
          </div>

          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full border border-red-600 text-red-600 rounded px-3 py-2 disabled:opacity-50"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Appointment'}
          </button>
        </section>
      )}
    </main>
  );
}
