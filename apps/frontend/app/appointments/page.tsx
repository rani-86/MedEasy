'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { appointmentApi, Appointment } from '@/lib/api/appointmentApi';

export default function AppointmentsPage() {
  return (
    <Suspense fallback={null}>
      <AppointmentsPageContent />
    </Suspense>
  );
}

function AppointmentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [doctorId, setDoctorId] = useState(searchParams.get('doctorId') ?? '');
  const [slotStart, setSlotStart] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState('');

  useEffect(() => {
    if (!accessToken) {
      router.push('/');
      return;
    }
    loadAppointments();
  }, [accessToken]);

  async function loadAppointments() {
    setLoading(true);
    setError('');
    try {
      const data = await appointmentApi.list();
      setAppointments(data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }

  async function handleBook() {
    setBookError('');
    if (!doctorId) {
      setBookError('Choose a doctor first');
      return;
    }
    if (!slotStart) {
      setBookError('Pick a date and time first');
      return;
    }
    setBooking(true);
    try {
      // datetime-local gives "2026-08-10T14:30" — the backend expects full ISO 8601
      const isoSlotStart = new Date(slotStart).toISOString();
      await appointmentApi.book(doctorId, isoSlotStart);
      setSlotStart('');
      await loadAppointments();
    } catch (err: any) {
      const apiError = err.response?.data?.error;
      setBookError(apiError?.details?.[0]?.message ?? apiError?.message ?? 'Booking failed');
    } finally {
      setBooking(false);
    }
  }

  async function handleCancel(id: string) {
    try {
      await appointmentApi.cancel(id);
      await loadAppointments();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Cancel failed');
    }
  }

  if (!accessToken) return null;

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Appointments</h1>
        <Link href="/doctors" className="text-sm text-gray-500 hover:underline">
          Find a Doctor
        </Link>
      </div>

      <section className="border rounded p-4 space-y-3">
        <h2 className="font-medium">Book a new appointment</h2>
        <p className="text-xs text-gray-500">
          <Link href="/doctors" className="underline">
            Find a doctor
          </Link>{' '}
          to fill this in, or paste a doctor ID directly.
        </p>
        <input
          type="text"
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Doctor ID"
        />
        <input
          type="datetime-local"
          value={slotStart}
          onChange={(e) => setSlotStart(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
        <button
          onClick={handleBook}
          disabled={booking}
          className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-50"
        >
          {booking ? 'Booking...' : 'Book Appointment'}
        </button>
        {bookError && <p className="text-red-600 text-sm">{bookError}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Upcoming & past</h2>
        {loading && <p className="text-sm text-gray-500">Loading...</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!loading && appointments.length === 0 && (
          <p className="text-sm text-gray-500">No appointments yet.</p>
        )}
        <ul className="space-y-2">
          {appointments.map((a) => (
            <li key={a.id} className="border rounded p-3 flex justify-between items-center">
              <Link href={`/appointments/${a.id}`} className="hover:underline">
                <p className="text-sm font-medium">{new Date(a.slotStart).toLocaleString()}</p>
                <p className="text-xs text-gray-500">Status: {a.status}</p>
              </Link>
              {a.status === 'booked' && (
                <button
                  onClick={() => handleCancel(a.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}