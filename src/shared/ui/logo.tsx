import { cn } from "cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className={cn("size-7", className)}>
      <defs>
        <linearGradient id="plainly-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C9BDFF" />
          <stop offset="1" stopColor="#7B5CFA" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="26" height="26" rx="8" fill="url(#plainly-logo)" />
      <path d="M8 9.5h12M8 14h8M8 18.5h5" stroke="#0B0B0F" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="19.5" cy="18.5" r="2" fill="#0B0B0F" />
    </svg>
  );
}
