import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { avatarColor, initials } from '../lib/util';

export function Avatar({ id, name, size = 26 }: { id: string; name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ background: avatarColor(id), width: size, height: size, fontSize: size * 0.46 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function OwnerChip({
  id,
  name,
  team,
  tag,
  size = 26,
  link = true,
}: {
  id: string;
  name: string;
  team?: ReactNode;
  tag?: ReactNode;
  size?: number;
  link?: boolean;
}) {
  const inner = (
    <span className="owner-chip">
      <Avatar id={id} name={name} size={size} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="owner-nm">{name}</span>
          {tag}
        </span>
        {team && <span className="owner-team" style={{ display: 'block' }}>{team}</span>}
      </span>
    </span>
  );
  return link ? <Link to={`/owners/${encodeURIComponent(id)}`}>{inner}</Link> : inner;
}
