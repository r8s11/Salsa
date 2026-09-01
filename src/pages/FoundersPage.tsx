import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import FounderRequestForm from "../components/Founder/FounderRequestForm";
import SalsaSeguraLogo from "../components/brand/SalsaSeguraLogo";
import type { FounderRequestPayload } from "../lib/founderRequest";
import "./FoundersPage.css";

/**
 * Submits through the `request-founder-access` Edge Function using the
 * project's canonical `supabase.functions.invoke` pattern (same as
 * invite-organizer): the SDK resolves the correct functions URL per
 * environment and always sends a valid key (publishable key when signed
 * out, session token when signed in) — no raw fetch URL juggling.
 *
 * Any failure is thrown as a generic error; the form converts it into a
 * safe, non-leaking message. Raw server/network errors are never shown.
 */
async function submitFounderRequest(payload: FounderRequestPayload): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke<{ success: boolean }>(
    "request-founder-access",
    { body: payload }
  );
  if (error || !data) {
    throw new Error("Founder request submission failed");
  }
  return data;
}

export default function FoundersPage() {
  return (
    <main className="founders-page">
      <header className="founders-header">
        <div className="founders-header-content">
          <Link className="founders-logo" to="/" aria-label="Salsa Segura home">
            <SalsaSeguraLogo variant="full" size="lg" tone="brand" />
          </Link>
        </div>
      </header>

      <div className="founders-content">
        <FounderRequestForm onSubmit={submitFounderRequest} />
      </div>

      <footer className="founders-footer">
        <Link to="/" className="footer-link">
          ← Back to SalsaSegura
        </Link>
      </footer>
    </main>
  );
}