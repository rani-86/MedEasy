const SIZES = {
  sm: { icon: 26, text: 'text-base' },
  md: { icon: 34, text: 'text-xl' },
  lg: { icon: 44, text: 'text-2xl' },
} as const;

export function Logo({ size = 'md' }: { size?: keyof typeof SIZES }) {
  const { icon, text } = SIZES[size];
  return (
    <div className="flex items-center gap-2">
      <svg width={icon} height={icon} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="20" cy="20" r="20" fill="var(--brand-soft)" />
        <path
          d="M13 11v8.5a7 7 0 0 0 14 0V16"
          stroke="var(--brand)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="27" cy="13.5" r="2.1" stroke="var(--brand)" strokeWidth="2" />
        <circle cx="20" cy="27" r="2.4" fill="var(--brand)" />
      </svg>
      <span className={`font-bold tracking-tight ${text}`} style={{ color: 'var(--foreground)' }}>
        Med<span style={{ color: 'var(--brand)' }}>Easy</span>
      </span>
    </div>
  );
}
