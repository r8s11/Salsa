import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/useAuth";
import { roleFromUser } from "../../contexts/authContextObject";
import { resolveCallbackDestination } from "../../lib/authDestination";
import { consumeAuthIntent } from "../../lib/authIntent";
import { consumeAuthReturnDestination } from "../../lib/authReturnDestination";
import Button from "../ui/Button";
import ButtonLink from "../ui/ButtonLink";
import "./AuthCallback.css";

/**
 * Signup confirmation, deliberately never Supabase's own single-shot GET
 * /auth/v1/verify: enterprise link scanners (Microsoft Safe Links, etc.)
 * prefetch that URL and silently consume the token before the recipient
 * clicks it. This route only ever reads `token_hash`/`type` from the URL —
 * it never calls verifyOtp() until the user explicitly clicks "Confirm
 * email", so a scanner's GET request (or React re-rendering this page) can
 * never burn the token. See supabase/functions/send-auth-email/index.ts.
 */
export default function ConfirmSignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { resendConfirmation } = useAuth();
  const [status, setStatus] = useState<"ready" | "busy" | "error">("ready");
  const [intentEmail, setIntentEmail] = useState<string | undefined>(undefined);
  const [resendStatus, setResendStatus] = useState<"idle" | "pending" | "sent" | "failed">("idle");

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const linkValid = !!tokenHash && type === "signup";

  const handleConfirm = useCallback(async () => {
    if (status === "busy" || !tokenHash) return;
    setStatus("busy");
    try {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "signup" });
      if (error) {
        setIntentEmail(consumeAuthIntent()?.email);
        setStatus("error");
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setIntentEmail(consumeAuthIntent()?.email);
        setStatus("error");
        return;
      }
      consumeAuthIntent();
      const role = roleFromUser(session.user);
      const returnDestination = consumeAuthReturnDestination();
      navigate(returnDestination ?? resolveCallbackDestination(role, params.get("next")), {
        replace: true,
      });
    } catch (err) {
      console.warn("Signup confirmation failed:", err instanceof Error ? err.message : err);
      setIntentEmail(consumeAuthIntent()?.email);
      setStatus("error");
    }
  }, [status, tokenHash, navigate, params]);

  const handleResendConfirmation = async () => {
    if (!intentEmail || resendStatus === "pending") return;
    setResendStatus("pending");
    const { error } = await resendConfirmation(intentEmail);
    setResendStatus(error ? "failed" : "sent");
  };

  if (!linkValid || status === "error") {
    return (
      <section className="auth-card">
        <h1>{linkValid ? "We couldn't confirm your email" : "Invalid confirmation link"}</h1>
        <p className="auth-error" role="alert">
          {linkValid
            ? "This confirmation link is invalid or has already been used. Links expire after a single use."
            : "This link is missing or malformed. Please use the link from your confirmation email."}
        </p>
        {intentEmail && (
          <Button
            variant="ghost"
            type="button"
            onClick={handleResendConfirmation}
            disabled={resendStatus === "pending"}
          >
            {resendStatus === "pending" ? "Sending…" : "Resend confirmation email"}
          </Button>
        )}
        {resendStatus === "sent" && (
          <p className="auth-message" role="status">
            Confirmation email sent. Please check your inbox.
          </p>
        )}
        {resendStatus === "failed" && (
          <p className="auth-error" role="alert">
            We couldn't send the email. Please try again shortly.
          </p>
        )}
        <ButtonLink to="/signin" variant="primary" block>
          Back to sign in
        </ButtonLink>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <h1>Confirm your email</h1>
      <p>Click below to finish creating your SalsaSegura account.</p>
      <Button
        type="button"
        block
        onClick={handleConfirm}
        loading={status === "busy"}
        loadingLabel="Confirming…"
      >
        Confirm email
      </Button>
    </section>
  );
}
