type Status = 'booked' | 'completed' | 'cancelled' | 'no_show';

const STYLE: Record<Status, { className: string; label: string }> = {
  booked: { className: 'badge-neutral', label: 'Booked' },
  completed: { className: 'badge-success', label: 'Completed' },
  cancelled: { className: 'badge-danger', label: 'Cancelled' },
  no_show: { className: 'badge-warning', label: 'No-show' },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLE[status as Status] ?? { className: 'badge-neutral', label: status };
  return <span className={`badge ${style.className}`}>{style.label}</span>;
}
