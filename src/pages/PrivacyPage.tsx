import { Link } from "react-router-dom";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";
import routeMeta from "../shared/seo/routeMeta.json";
import "./LegalPage.css";

const EMAIL = "info@salsasegura.com";

export default function PrivacyPage() {
  useDocumentMeta({ ...routeMeta.privacy, canonical: canonicalUrl(routeMeta.privacy.path) });

  return (
    <main className="legal-page">
      <article className="legal-page__inner">
        <h1>Privacy Policy</h1>
        <p className="legal-page__updated">Last updated: November 20, 2026</p>

        <h2>Who we are</h2>
        <p>
          Salsa Segura is a calendar and directory of salsa, bachata, and Latin dance events in
          Greater Boston and New York City, at salsasegura.com. Questions about this policy or your
          data: <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>

        <h2>What we collect</h2>
        <p>
          <strong>Account.</strong> If you create an account we collect your email address and, if
          you sign up with email, a password. Authentication is run by Supabase (see below).
        </p>
        <p>
          <strong>Sign in with Apple, Google, or Facebook.</strong> When you use one of these, the
          provider tells us who you are, typically your name and email address and, depending on the
          provider and your settings there, a profile picture. If you choose to hide your email from
          Apple, we receive an Apple relay address instead. We never receive your password for
          Apple, Google, or Facebook.
        </p>
        <p>
          <strong>Profile.</strong> Your display name, plus anything you choose to add: a photo,
          cover photo, bio, home city, dance styles, Instagram link, website link, notification
          preferences, and two visibility settings (whether your profile is public at its
          salsasegura.com/u/ address, including to visitors who are not signed in, and whether your
          activity numbers show on it). Both visibility settings start switched on, and
          you can change them under{" "}
          <Link to="/profile/edit">Edit profile</Link>.
        </p>
        <p>
          <strong>Event submissions.</strong> Event details you submit or edit, any flyer images you
          upload, and the submitter and contact email addresses attached to the listing. Listings
          are reviewed before they appear. We also store how you reached the site, described under
          &ldquo;How you found us&rdquo; below.
        </p>
        <p>
          <strong>Contact form.</strong> The name, email, area of interest, and message you type
          into the form on our <Link to="/contact">Contact</Link> page.
        </p>
        <p>
          <strong>Shop.</strong> Our shop is powered by Shopify. We keep the ID of your cart in your
          browser so it can be restored on your next visit. Checkout takes place on Shopify&rsquo;s
          pages, where Shopify collects the details it needs to complete your order.
        </p>
        <p>
          <strong>Usage and diagnostics.</strong> Page and interaction analytics, error reports, and
          logs of event-submission outcomes, described under &ldquo;Analytics&rdquo; below.
        </p>

        <h2>How we use it</h2>
        <ul>
          <li>To sign you in and run your account and profile.</li>
          <li>To review, publish, and manage event listings.</li>
          <li>To send sign-in, account, and listing-related emails.</li>
          <li>To answer messages sent through the contact form or by email.</li>
          <li>To let you add products to a cart and check out in the shop.</li>
          <li>To understand how the site is used and to find and fix errors.</li>
        </ul>

        <h2>Who processes your data</h2>
        <p>We use these services to run Salsa Segura:</p>
        <ul>
          <li>
            <strong>Supabase</strong>: authentication, our database, and file storage (profile
            images and event flyers).
          </li>
          <li>
            <strong>Apple, Google, and Facebook (Meta)</strong>: only if you choose to sign in with
            them.
          </li>
          <li>
            <strong>Resend</strong>: delivers the emails we send, such as sign-in and confirmation
            emails and listing notifications.
          </li>
          <li>
            <strong>Shopify</strong>: the shop, cart, and checkout.
          </li>
          <li>
            <strong>PostHog</strong>: product analytics, error reports, and logs.
          </li>
          <li>
            <strong>Umami</strong>: cookieless website analytics.
          </li>
          <li>
            <strong>Web3Forms</strong>: delivers contact-form messages to us.
          </li>
          <li>
            <strong>OpenAI</strong>: reads flyer images to pre-fill event details, see below.
          </li>
        </ul>

        <h2>Analytics</h2>
        <p>
          PostHog is set up without cookies or browser storage: an anonymous identifier lasts only
          until you reload or close the page. When you are signed in, activity can be associated
          with your account. PostHog receives the pages you open on the site, error reports, a
          small number of named events (for example viewing an event, clicking its RSVP link, or
          starting checkout) with the event&rsquo;s ID, organizer and city, and logs about whether
          an event submission succeeded. Each of these also carries the city you have selected and
          how you reached the site.
        </p>
        <p>
          Umami also runs without cookies and counts visits to the site. When you view, share, or
          click through from an event, we record that interaction with the event&rsquo;s ID and
          city in Umami and in our own database, without recording who you are.
        </p>

        <h2>How you found us</h2>
        <p>
          When you arrive from a link that includes campaign tags (for example a link in one of
          our Instagram or TikTok posts), or from another website, we note the campaign tags, the
          name of the referring website (not the full address of the page), and the page you
          landed on. This note is kept only in the open page, not in a cookie or browser storage.
          If you submit an event or create an account during that visit, we save it with the
          submission or with your account so we can tell which posts and campaigns bring dancers
          and organizers to the site. We do not record it for direct visits.
        </p>

        <h2>Flyer reading with OpenAI</h2>
        <p>
          When a signed-in user asks us to read an event flyer, the flyer image is sent to OpenAI,
          which returns the event details we pre-fill. A record of each request, including the
          content sent to OpenAI, is also kept in PostHog for monitoring quality and cost.
        </p>

        <h2>Cookies and local storage</h2>
        <p>We do not use advertising cookies. Your browser&rsquo;s storage is used for:</p>
        <ul>
          <li>Keeping you signed in (Supabase session).</li>
          <li>Remembering your selected city and neighborhood.</li>
          <li>Remembering your shop cart ID.</li>
          <li>Keeping a note that you have viewed an event today, so views are not counted twice.</li>
        </ul>
        <p>
          Shopify&rsquo;s checkout and the sign-in pages of Apple, Google, and Facebook are run by
          those companies and may set their own cookies under their own policies.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>
            If your browser sends Do Not Track or Global Privacy Control, we do not load PostHog,
            do not note how you found us, and do not record event view, share, or click-through
            interactions.
          </li>
          <li>
            Edit or remove most profile details, and change your visibility settings, under{" "}
            <Link to="/profile/edit">Edit profile</Link>.
          </li>
          <li>
            Delete your account from the <Link to="/account">Account</Link> page. See{" "}
            <Link to="/data-deletion">how to delete your data</Link> for what is removed and when
            deletion is not available.
          </li>
          <li>
            Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a> for any other request about your data.
          </li>
        </ul>

        <h2>Children</h2>
        <p>
          Salsa Segura is not directed to children under 13, and we do not knowingly collect their
          personal information. If you believe a child has given us information, email{" "}
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a> and we will remove it.
        </p>

        <h2>Changes</h2>
        <p>
          If we change this policy we will update this page and the date at the top.
        </p>
      </article>
    </main>
  );
}
