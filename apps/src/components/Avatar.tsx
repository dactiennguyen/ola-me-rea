import { useState } from 'react';
import { colorFor, initials } from '../lib/format.ts';

interface AvatarProps {
  name: string;
  photo?: string;
  /** Key for the fallback color; defaults to the name. */
  seed?: string;
  color?: string;
  size?: number;
  online?: boolean;
  /** Ring color behind the online dot (the surface it sits on). */
  ring?: string;
}

/** Photo when it loads, otherwise initials on a color derived from the seed. */
export function Avatar({ name, photo, seed, color, size = 38, online, ring = 'var(--surface)' }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const radius = Math.round(size * 0.26);
  const showPhoto = Boolean(photo) && !broken;
  return (
    <span className="avatar" style={{ width: size, height: size, borderRadius: radius }}>
      {showPhoto ? (
        <img src={photo} alt="" width={size} height={size} style={{ borderRadius: radius }} onError={() => setBroken(true)} />
      ) : (
        <span
          className="avatar-initials"
          style={{ background: color ?? colorFor(seed ?? name), borderRadius: radius, fontSize: Math.max(11, Math.round(size * 0.34)) }}
        >
          {initials(name)}
        </span>
      )}
      {online && <span className="avatar-dot" style={{ borderColor: ring }} aria-hidden="true" />}
    </span>
  );
}
