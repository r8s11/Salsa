import { Link } from "react-router-dom";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";
import routeMeta from "../shared/seo/routeMeta.json";
import "./LegalPage.css";

const EMAIL = "info@salsasegura.com";

export default function DataDeletionPage() {
  useDocumentMeta({
    ...routeMeta.dataDeletion,
    canonical: canonicalUrl(routeMeta.dataDeletion.path),
  });

  return (
    <main className="legal-page">
      <article className="legal-page__inner">
        <h1>Delete your data</h1>
        <p className="legal-page__updated">Last updated: November 5, 2026</p>

        <p>
          This page explains how to delete your Salsa Segura account and data, including accounts
          created with Sign in with Apple, Google, or Facebook. See our{" "}
          <Link to="/privacy">Privacy Policy</Link> for what we collect.
        </p>

        <h2>Delete your account yourself</h2>
        <ol role="list">
          <li>
            <Link to="/signin">Sign in</Link> to your account.
          </li>
          <li>
            Open the <Link to="/account">Account</Link> page and scroll to the &ldquo;Danger
            zone&rdquo; section.
          </li>
          <li>Select &ldquo;Delete account&rdquo;.</li>
          <li>
            In the &ldquo;Permanently delete account?&rdquo; dialog, type DELETE and confirm with
            &ldquo;Delete account&rdquo;.
          </li>
        </ol>

        <h2>What gets deleted</h2>
        <p>
          Deleting your account permanently removes your sign-in and the personal account data that
          is safe to remove. This cannot be undone through Salsa Segura. A sign-in token that was
          already issued may keep working until it expires.
        </p>
        <p>
          Event, organizer, and moderation records are never removed by this action. That is why
          deletion is blocked, as described next, while such records are tied to your account.
        </p>

        <h2>When self-service deletion is not available</h2>
        <p>The Account page will tell you that deletion is not available when:</p>
        <ul>
          <li>Your account has an organizer, moderator, or admin role.</li>
          <li>
            Your account has event or submission history, including events or submissions made with
            your email address.
          </li>
          <li>You have organizer access or an organizer request.</li>
          <li>
            Your account has protected operational history, such as moderation, import, or audit
            records.
          </li>
          <li>You own uploaded files, such as flyers.</li>
          <li>We cannot verify right now whether your account can be deleted.</li>
        </ul>

        <h2>Ask us to delete it</h2>
        <p>
          If you cannot delete your account yourself, or you prefer not to, email{" "}
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a> from the email address on your account and say
          what you would like deleted. We use the sender address to confirm the request is yours.
        </p>

        <h2>Remove the connection on Apple, Google, or Facebook</h2>
        <p>
          If you signed in with Apple, Google, or Facebook, you can also remove Salsa Segura from
          the list of apps connected to that account, in the security or apps settings of your Apple,
          Google, or Facebook account. Doing this stops the provider from sharing further
          information with us. It does not delete the Salsa Segura account itself, so delete the
          account first using the steps above or by email.
        </p>
      </article>
    </main>
  );
}
