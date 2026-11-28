import { useState } from "react";
import { Link } from "react-router-dom";
import type { ProfileMedia } from "../model";
import "./ProfileMediaStrip.css";


function Tile({ item, onFail }: { item: ProfileMedia; onFail: () => void }) {
  const img = <img src={item.src} alt={item.alt} loading="lazy" decoding="async" onError={onFail} />;
  return item.to ? <Link className="profile-media__tile" to={item.to}>{img}</Link> : <span className="profile-media__tile">{img}</span>;
}

/** A row of photo tiles under a profile hero; scrolls sideways on a phone. */
export function ProfileMediaStrip({ items, label }: { items: ProfileMedia[]; label: string }) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const shown = items.filter((item) => !failed.has(item.src));
  if (shown.length === 0) return null;
  return (
    <ul className="profile-media" aria-label={label}>
      {shown.map((item) => (
        <li key={item.src}>
          <Tile item={item} onFail={() => setFailed((prev) => new Set(prev).add(item.src))} />
        </li>
      ))}
    </ul>
  );
}
