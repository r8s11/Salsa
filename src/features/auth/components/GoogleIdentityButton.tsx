import { useEffect, useRef, useState } from "react";

const GIS_SRC = "https://accounts.google.com/gsi/client";

type CredentialResponse = { credential?: string };
type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: CredentialResponse) => void;
        nonce: string;
        ux_mode: "popup";
        use_fedcm_for_button: boolean;
        auto_select: boolean;
        itp_support: boolean;
      }): void;
      renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
    };
  };
};

declare global {
  interface Window { google?: GoogleIdentity }
}

let scriptPromise: Promise<void> | null = null;

function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => (window.google?.accounts?.id ? resolve() : reject(new Error("Google Identity Services unavailable")));
    script.onerror = () => reject(new Error("Google Identity Services failed to load"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Google's own "Continue with Google" button. The sign-in happens on
 * salsasegura.com (popup/FedCM), so Google names this site rather than the
 * Supabase project host. Google receives the SHA-256 of a one-time nonce; the
 * raw nonce goes to Supabase with the ID token so Supabase can verify it.
 * When the script cannot load (blocked, offline), `onUnavailable` lets the
 * caller fall back to the redirect flow.
 */
export default function GoogleIdentityButton({ clientId, disabled, onCredential, onUnavailable }: {
  clientId: string;
  disabled: boolean;
  onCredential: (idToken: string, rawNonce: string) => void;
  onUnavailable: () => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // Latest handlers without re-initialising Google on every render.
  const handlers = useRef({ onCredential, onUnavailable });
  useEffect(() => {
    handlers.current = { onCredential, onUnavailable };
  });

  useEffect(() => {
    let alive = true;
    const rawNonce = crypto.randomUUID();
    (async () => {
      try {
        const [hashedNonce] = await Promise.all([sha256Hex(rawNonce), loadGoogleIdentity()]);
        const target = slot.current;
        if (!alive || !target || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce: hashedNonce,
          ux_mode: "popup",
          use_fedcm_for_button: true,
          auto_select: false,
          itp_support: true,
          callback: ({ credential }) => {
            if (credential) handlers.current.onCredential(credential, rawNonce);
          },
        });
        window.google.accounts.id.renderButton(target, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "center",
          width: Math.min(400, Math.max(200, Math.round(target.clientWidth))),
        });
        setReady(true);
      } catch {
        if (alive) handlers.current.onUnavailable();
      }
    })();
    return () => { alive = false; };
  }, [clientId]);

  return (
    <div
      ref={slot}
      className="social-auth-google"
      aria-busy={!ready || undefined}
      // Google renders into an iframe; block it while another auth call runs.
      style={disabled ? { pointerEvents: "none", opacity: 0.6 } : undefined}
    />
  );
}
