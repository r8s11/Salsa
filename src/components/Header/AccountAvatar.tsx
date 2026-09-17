import { useState } from "react";
import { resolveAvatarIdentity } from "../../features/account/model/account";
import type { OwnProfile } from "../../features/account/model/account";

interface AccountAvatarProps {
  avatarUrl?: string | null;
  displayName?: OwnProfile["display_name"];
  username?: OwnProfile["username"];
  email?: string | null;
  size?: number;
}

/** Compact circular avatar for the Header account-menu trigger: profile photo, or initials. */
export default function AccountAvatar({
  avatarUrl,
  displayName = null,
  username = null,
  email,
  size = 40,
}: AccountAvatarProps) {
  // A stored URL can dangle (object deleted, cache miss). Fall back to
  // initials rather than a broken-image icon; a new URL retries the load.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (avatarUrl && failedUrl !== avatarUrl) {
    return (
      <img
        className="account-avatar"
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailedUrl(avatarUrl)}
      />
    );
  }

  const { initials } = resolveAvatarIdentity({ display_name: displayName, username }, email);

  return (
    <span
      className="account-avatar account-avatar--initials"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
