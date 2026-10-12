import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';
import { useId } from 'react';

/**
 * Game Tracker's mark: an original legendary sword (blade with a fuller, curved
 * guard, grip and pommel), drawn diagonally. Not based on any game's design.
 * `gradient` paints it with the brand gradient (blue → violet → warm).
 */
export function SwordIcon({ gradient = false, ...props }: SvgIconProps & { gradient?: boolean }) {
  const id = useId();
  const fill = gradient ? `url(#${id})` : undefined;
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {gradient ? (
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0.1" stopColor="#7c9cff" />
            <stop offset="0.55" stopColor="#b48cff" />
            <stop offset="1" stopColor="#ffb74d" />
          </linearGradient>
        </defs>
      ) : null}
      <g fill={fill}>
        <g transform="rotate(45 12 12)">
          {/* Blade with its fuller. */}
          <path d="M12 1.2 14 4.4v10.1h-4V4.4z" />
          <path d="M11.6 5h.8v8.6h-.8z" opacity={0.35} fill="#000" />
          {/* Guard with upturned tips. */}
          <path d="M4.2 13.6q.9 1.2 2.4 1.2h10.8q1.5 0 2.4-1.2v1.9q-.9 1.4-2.4 1.4H6.6q-1.5 0-2.4-1.4z" />
          {/* Grip and pommel. */}
          <path d="M11 16.9h2v3.9h-2z" />
          <circle cx="12" cy="21.6" r="1.4" />
        </g>
      </g>
    </SvgIcon>
  );
}
