# Organizers

Create and maintain event listings, review your submissions, and use the Host desk's organizer tools. Last checked locally November 9, 2026; release requires the migrations listed in [implementation status](improvements.md#verification-and-rollout).

## Get organizer access

1. Create your personal Salsa Segura account and finish any requested profile setup. [Account instructions](dancers.md#create-an-account-or-sign-in).
2. [Contact Salsa Segura](https://www.salsasegura.com/contact) to request access to the organizer you represent. Include its name, city, public website, your account email, and your relationship to it.
3. After access is granted, open the [Host desk](https://www.salsasegura.com/host).
4. Check **Your organizers** and your role. If you represent several organizers, make sure you select the correct one before creating or importing events.

Claiming a school, venue, DJ, or artist does not grant organizer membership. Someone can have listing-workspace access without being able to create organizer events.

### What each organizer role can do

| Role on an active organizer | Event and organizer capabilities |
| --- | --- |
| Owner or Manager | Create and edit that organizer's events, use imports, and edit its organization details. |
| Editor | View organizer information and available event listings; the event/organization editing screens are read-only. |
| No active membership | You can use public submission when open, but cannot create or edit events for that organizer. |

A role label alone is not enough: access must belong to the organizer attached to the event. Contact Salsa Segura for organizer membership changes. The listing-team instructions for schools, venues, artists, and DJs do not manage organizer membership.

## Choose the right event workflow

| Your task | Use | What happens |
| --- | --- | --- |
| Suggest an event for moderation | [Submit an event](https://www.salsasegura.com/submit) | A submission waits for review; it is not immediately published. |
| Create an event for an organizer you actively own or manage | [Create event](https://www.salsasegura.com/host/events/new) | You choose Save Draft or Publish Event. |
| Add a batch from a spreadsheet | [Import CSV](https://www.salsasegura.com/host/events/import) | Valid selected rows create drafts. |
| Add a batch from flyers | [Import Flyers](https://www.salsasegura.com/host/events/import-flyers) | Review and confirm each flyer, then save drafts or publish. |

The public submission form can say **Submit for review** for an organizer account. That is still the review workflow; it is not the same as **Publish Event** in the organizer creation screen.

## Create an event

1. Select **Create event** from the Host desk or open [Create event](https://www.salsasegura.com/host/events/new).
2. Check **Creating event for**. Choose an organizer if more than one is available.
3. Complete the event's title, city, date, start time, location, and other fields. Correct any errors shown before saving.
4. Choose the event types and dance styles. If several types apply, the first selected type is the primary category used for calendar coloring.
5. Enter price and ticket/RSVP information accurately. Use a complete link to the actual booking or ticket page. Adding a link does not make Salsa Segura the ticket seller.
6. Add host and contact details where appropriate. Check venue/address spelling, and NYC borough/neighborhood choices when applicable.
7. Optionally add flyer images. JPEG, PNG, and WebP files up to 5 MB each are supported. Keep the primary flyer first and use the reorder controls when needed.
8. Check recurrence. Use the weekly option only for an event that actually repeats; do not use it just to avoid creating different dated events.
9. Choose:
   - **Save Draft** to keep the event off the public calendar.
   - **Publish Event** to publish a complete event immediately under your organizer access.
10. Check the event detail page and its status. For an approved event, open its public link and check the result.

If the event saves but a flyer fails, read the warning. Open the saved event and add the flyer there; do not create a second event just to retry the image upload.

### Publish a saved draft

Saving or importing a draft does not publish it, and **Save Changes** never publishes. When a draft is ready:

1. Open [My Events](https://www.salsasegura.com/host/events) and open the draft.
2. Select **Edit Event**.
3. If you changed anything, select **Save Changes** first. Publishing is blocked while the form has unsaved changes.
4. Select **Publish Event**.
5. Wait for **Event published. It is now live on SalsaSegura.**, then use **View public event** to check the result.

**Publish Event** appears only on drafts, and only for active Owner or Manager members of the event's organizer. If publishing fails, the event stays a draft; read the message and try again. Do not create a duplicate live event.

## Find and edit your events

1. Open [My Events](https://www.salsasegura.com/host/events).
2. Search by event and use the organizer selector or status filters as needed.
3. Select **Manage Event** when available. Events you cannot manage may instead offer **View Event**.
4. On the event page, select **Edit Event**.
5. Correct the details, then select **Save Changes**.
6. Check the saved event and, if it is published, its public page.

Only active Owner or Manager members of that event's organizer can edit it. A listing-owner role on its venue does not satisfy this requirement. The Host event editor does not transfer an event to another organizer. The only status change it offers is **Publish Event** on a draft.

### Read event and submission states

| State | Meaning |
| --- | --- |
| Draft | Saved, but not public. |
| Pending | Waiting for review. |
| Approved | Published and available through the public event listing. |
| Rejected | Not approved; follow any review information and revise where offered. |
| Cancelled or archived | Not an ordinary active public event. Ask Salsa Segura about changes not offered in your workspace. |

For your public-form submissions, check **My submissions** on [your profile](https://www.salsasegura.com/profile). Pending or rejected entries can offer **Edit**; some Host detail pages offer **Edit event** or **Revise event** instead. Follow that action rather than creating a new copy.

## Import a spreadsheet

Owner or Manager access to an active organizer is required.

1. Open [Import CSV](https://www.salsasegura.com/host/events/import).
2. Select **Import to:** if shown, before uploading the file.
3. Select **Download CSV Template**, then fill it with one event per row.
4. Keep the required columns: `title`, `event_type`, `event_date`, and `city`.
5. Use dates like `2026-11-20` and 24-hour times like `20:00`. Separate multiple values with semicolons where the template calls for them. Set `recurrence` to `weekly` only for a weekly event.
6. Upload a CSV containing no more than 100 event rows.
7. Review valid rows, warnings, and errors. Use **Download error rows as CSV** to correct invalid data outside the app and upload the corrected file.
8. Inspect possible duplicates. They are excluded unless you explicitly choose **Import anyway**; use that only after confirming the event is genuinely different.
9. Select **Import Valid Events** and review **Import Complete**, including created and failed counts.
10. Check My Events. Imported events are drafts, not published listings; publish each one when it is ready (see [Publish a saved draft](#publish-a-saved-draft)).

If only some rows fail, keep a record of the successful ones before retrying. Do not blindly re-import the original batch.

## Import flyers

1. Open [Import Flyers](https://www.salsasegura.com/host/events/import-flyers) and choose the organizer.
2. Add the flyer images. Allow the upload and extraction to finish.
3. Open each flyer and compare the extracted title, date, time, city, venue, price, recurrence, and contact information with the actual flyer.
4. Correct errors and review any proposed listing matches. If extraction fails, use **Retry analysis** or **Continue manually** as offered.
5. Select **Confirm details against flyer** after reviewing each flyer. Changing a confirmed row's details requires confirming it again.
6. Use **Skip this flyer** for anything that should not become an event.
7. Save the confirmed flyers as drafts, or use **Publish** when they are ready to go live. Read the displayed count before acting.
8. Check saved/published results and retry only failed items. A confirmed flyer is ready to save; confirmation itself is not publication.

Always review extracted information. Flyer text and matching suggestions can be incomplete or wrong.

## Maintain organizer details

1. Open [Organization](https://www.salsasegura.com/host/organization).
2. Select the organizer when you have more than one.
3. With Owner or Manager access, select its edit action.
4. Update **Organization name**, **About**, **Organization type**, **Primary city**, **Website**, **Instagram handle**, and **Logo URL** as needed.
5. Select **Save Changes** and check the result.

Use this screen for the organizer's public/business information, not the personal email used to sign in. The current page is not a team-invitation interface.

## Attendees and the door

These tools apply to event records you are authorized to manage. They do not automatically import customers from the external ticket/RSVP link.

### Add to the roster

1. Open the event in Host and select **Attendees**.
2. Under **Add Attendee**, enter the required name and any optional email, category, notes, and party size. Party size is 1–20.
3. Select **Add Attendee** and confirm the entry appears.
4. Check both the entry count and total headcount; one entry can represent a party.

To correct an entry, select **Edit** on its row, change the name, email, category, party size, or notes, then select **Save changes**. You return to the roster, and the entry keeps its check-in history. **Cancel** returns without saving. Do not remove and re-add someone to fix a detail.

Use **Remove** only when the attendance record should be deleted, and read the confirmation.

Keep attendee details private and do not put payment details or sensitive personal information in Notes.

### Check people in

1. From the event page, open **Check-in**.
2. Search the roster by name or email.
3. Check the attendee and party information, then select **Check In** on the correct row.
4. Confirm that **Checked in** appears and the counts update. The page counts roster entries and party headcount separately.

Checking in records arrival; it does not collect money or verify an external ticket.

If you check in the wrong person, select **Undo check-in** on that row. The mistake moves to **Recent Reversals**, where it stays as history. If that person does arrive later, select **Re-check-in** there, or **Check In** on their row. One attendee can have only one active check-in at a time.

## Share, cancel, or remove an event

For a published event, use its public link and sharing controls to send it to dancers. [The dancer guide](dancers.md#tickets-calendars-and-sharing) explains posters, links, and calendars.

For a cancellation or status change not offered in Host, contact Salsa Segura promptly with the event link and the cancellation details. **Cancel** beside a form normally leaves that form; it is not an event-cancellation action.

**Delete Event** is destructive. Its confirmation states that it permanently removes the event and attendee records. Do not use deletion as a substitute for recording a cancellation or keeping historical information.

## If you are blocked

- **No Create event or Import action:** check your active organizer membership and role. A personal account, listing claim, or organizer label alone is not enough.
- **An event cannot be edited:** confirm it belongs to an organizer you actively own or manage.
- **A newly saved draft is not on the calendar:** drafts are not public. Open the draft, select **Edit Event**, then **Publish Event**.
- **The event saved but the flyer did not:** edit the saved event and retry the flyer, rather than re-creating the event.
- **A batch partly succeeded:** review the result before retrying; avoid duplicates.
- **A page or control fails:** send the link, exact message, and the organizer you represent to [Contact Salsa Segura](https://www.salsasegura.com/contact). Never send passwords or sign-in links.

[All guides](README.md) · [Your personal account](dancers.md) · [School workspaces](schools.md) · [Listing access and teams](listing-access.md)
