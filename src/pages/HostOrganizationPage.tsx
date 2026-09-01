import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Globe, MapPin, Pencil } from "lucide-react";
import { useMyOrganizers } from "../features/host/hooks/useMyOrganizers";
import {
  fetchOrganizerProfile,
  updateOrganizerProfile,
  OrganizerAccessError,
} from "../features/host/api/organizerAccessRepo";
import type {
  OrganizerMembership,
  OrganizerProfileUpdatePayload,
} from "../features/host/api/organizerAccessRepo";
import { ORGANIZER_TYPE_LABEL, type OrganizerType } from "../features/admin/model/organizerRequestsQuery";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import "./HostOrganizationPage.css";

/* ── Types ── */

interface OrganizerForm {
  name: string;
  description: string;
  logo_url: string;
  website: string;
  instagram: string;
  organizer_type: string;
  primary_city: string;
}

type FieldErrors = Partial<Record<keyof OrganizerForm, string>>;

/* ── Helpers ── */

function formFromOrganizer(org: OrganizerMembership): OrganizerForm {
  return {
    name: org.organizerName,
    description: org.description ?? "",
    logo_url: org.logoUrl ?? "",
    website: org.website ?? "",
    instagram: org.instagram ?? "",
    organizer_type: org.organizerType ?? "",
    primary_city: org.primaryCity ?? "",
  };
}

function buildPayload(form: OrganizerForm, original: OrganizerMembership): OrganizerProfileUpdatePayload {
  const payload: OrganizerProfileUpdatePayload = {};
  if (form.name !== original.organizerName) payload.name = form.name;
  if (form.description !== (original.description ?? "")) payload.description = form.description || null;
  if (form.logo_url !== (original.logoUrl ?? "")) payload.logo_url = form.logo_url || null;
  if (form.website !== (original.website ?? "")) payload.website = form.website || null;
  if (form.instagram !== (original.instagram ?? "")) payload.instagram = form.instagram || null;
  if (form.organizer_type !== (original.organizerType ?? "")) payload.organizer_type = form.organizer_type || null;
  if (form.primary_city !== (original.primaryCity ?? "")) payload.primary_city = form.primary_city || null;
  return payload;
}

function validateForm(form: OrganizerForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = "Organization name is required.";
  else if (form.name.length > 200) errors.name = "Name must be 200 characters or fewer.";
  if (form.description.length > 2000) errors.description = "Description must be 2000 characters or fewer.";
  if (form.logo_url && !isValidUrl(form.logo_url)) errors.logo_url = "Must be a valid http:// or https:// URL.";
  if (form.website && !isValidUrl(form.website)) errors.website = "Must be a valid http:// or https:// URL.";
  if (form.instagram.length > 100) errors.instagram = "Instagram handle must be 100 characters or fewer.";
  if (form.organizer_type && !(form.organizer_type in ORGANIZER_TYPE_LABEL)) {
    errors.organizer_type = "Invalid organizer type.";
  }
  return errors;
}

function isValidUrl(value: string): boolean {
  try {
    return new URL(value).protocol.startsWith("http");
  } catch {
    return false;
  }
}

function OrganizerInitials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="host-org__logo-fallback" aria-hidden="true">
      <span>{initials || "?"}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "active" ? "Active" : status === "suspended" ? "Suspended" : "Archived";
  return <span className={`host-org__status host-org__status--${status}`}>{label}</span>;
}

/* ── Main Component ── */

export default function HostOrganizationPage() {
  const { data: organizers = [], isLoading, error: organizersError, refetch } = useMyOrganizers();
  const activeOrganizers = useMemo(
    () => organizers.filter((o) => o.organizerStatus === "active" || o.organizerStatus === "suspended"),
    [organizers]
  );
  const [selectedOrganizerId, setSelectedOrganizerId] = useState<string>(
    activeOrganizers[0]?.organizerId ?? ""
  );

  const selectedMembership = activeOrganizers.find((o) => o.organizerId === selectedOrganizerId);
  const canEdit = selectedMembership?.memberRole === "owner" || selectedMembership?.memberRole === "manager";

  const [organizer, setOrganizer] = useState<OrganizerMembership | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<OrganizerForm | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadOrganizer = useCallback(async (organizerId: string) => {
    if (!organizerId) return;
    setLoading(true);
    setLoadError(null);
    setEditing(false);
    setForm(null);
    setSaveSuccess(false);
    try {
      const profile = await fetchOrganizerProfile(organizerId);
      setOrganizer(profile);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load organizer.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOrganizerId) loadOrganizer(selectedOrganizerId);
  }, [selectedOrganizerId, loadOrganizer]);

  const startEditing = () => {
    if (!organizer) return;
    setForm(formFromOrganizer(organizer));
    setFieldErrors({});
    setSaveError(null);
    setSaveSuccess(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setForm(null);
    setFieldErrors({});
    setSaveError(null);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!organizer || !form || saving) return;
    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = buildPayload(form, organizer);
    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await updateOrganizerProfile(organizer.organizerId, payload);
      const refreshed = await fetchOrganizerProfile(organizer.organizerId);
      setOrganizer(refreshed);
      setEditing(false);
      setSaveSuccess(true);
      void refetch();
    } catch (err) {
      if (err instanceof OrganizerAccessError) {
        setSaveError("You don't have permission to edit this organization.");
      } else {
        setSaveError(err instanceof Error ? err.message : "We couldn't save these changes. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="admin-shell">
        <AdminPageHeader title="Organization" description="View and manage your organizer identity." />
        <p role="status" className="host-org__status-msg">Checking organizer access…</p>
      </main>
    );
  }

  if (organizersError) {
    return (
      <main className="admin-shell">
        <AdminPageHeader title="Organization" description="View and manage your organizer identity." />
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load your organizers.</p>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void refetch()}>
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (activeOrganizers.length === 0) {
    return (
      <main className="admin-shell">
        <AdminPageHeader title="Organization" description="View and manage your organizer identity." />
        <div className="admin-card host-org__empty">
          <p>You don&apos;t have access to any organizations yet.</p>
          <Link to="/host" className="admin-btn admin-btn--primary">Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <AdminPageHeader
        title="Organization"
        description={
          selectedMembership
            ? `Manage ${selectedMembership.organizerName}.`
            : "View and manage your organizer identity."
        }
        actions={
          <Link to="/host" className="admin-btn admin-btn--secondary">
            Back to Dashboard
          </Link>
        }
      />

      {activeOrganizers.length > 1 && (
        <div className="admin-card host-org__selector">
          <label htmlFor="org-select">Organization</label>
          <select
            id="org-select"
            value={selectedOrganizerId}
            onChange={(e) => setSelectedOrganizerId(e.target.value)}
          >
            {activeOrganizers.map((o) => (
              <option key={o.organizerId} value={o.organizerId}>
                {o.organizerName}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && <p role="status" className="host-org__status-msg">Loading…</p>}

      {loadError && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => loadOrganizer(selectedOrganizerId)}>
            Try Again
          </button>
        </div>
      )}

      {saveSuccess && (
        <div className="admin-banner admin-banner--success" role="status">
          Organization updated.
        </div>
      )}

      {organizer && !editing && (
        <section className="admin-card host-org__profile">
          <div className="host-org__header">
            {organizer.logoUrl ? (
              <img
                src={organizer.logoUrl}
                alt={`${organizer.organizerName} logo`}
                className="host-org__logo"
              />
            ) : (
              <OrganizerInitials name={organizer.organizerName} />
            )}
            <div className="host-org__header-text">
              <h2>{organizer.organizerName}</h2>
              {organizer.organizerType && (
                <p className="host-org__type">
                  {ORGANIZER_TYPE_LABEL[organizer.organizerType as OrganizerType] ?? organizer.organizerType}
                </p>
              )}
              {organizer.primaryCity && (
                <p className="host-org__city">
                  <MapPin size={14} aria-hidden="true" />
                  {organizer.primaryCity}
                </p>
              )}
              <StatusBadge status={organizer.organizerStatus} />
            </div>
            {canEdit && (
              <button
                type="button"
                className="admin-btn admin-btn--primary host-org__edit-btn"
                onClick={startEditing}
              >
                <Pencil size={14} aria-hidden="true" />
                Edit Organization
              </button>
            )}
            {!canEdit && (
              <span className="host-org__view-only">View only</span>
            )}
          </div>

          <div className="host-org__fields">
            <div className="host-org__field">
              <h3>About</h3>
              <p>{organizer.description || "No description added yet."}</p>
            </div>
            <div className="host-org__field">
              <h3>Website</h3>
              {organizer.website ? (
                <a href={organizer.website} target="_blank" rel="noopener noreferrer">
                  <Globe size={14} aria-hidden="true" />
                  {organizer.website}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              ) : (
                <p>Not added.</p>
              )}
            </div>
            <div className="host-org__field">
              <h3>Instagram</h3>
              {organizer.instagram ? (
                <a
                  href={`https://instagram.com/${organizer.instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{organizer.instagram.replace(/^@/, "")}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              ) : (
                <p>Not added.</p>
              )}
            </div>
            {selectedMembership && (
              <div className="host-org__field">
                <h3>Your Access</h3>
                <p>{selectedMembership.memberRole === "owner" ? "Owner" : selectedMembership.memberRole === "manager" ? "Manager" : "Editor"}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {organizer && editing && form && (
        <form onSubmit={handleSave} className="admin-card host-org__form">
          <h2>Edit Organization</h2>

          {saveError && (
            <div className="admin-banner admin-banner--error" role="alert">
              <p>{saveError}</p>
            </div>
          )}

          <div className="host-org__form-field">
            <label htmlFor="org-name">Organization name</label>
            <input
              id="org-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={200}
            />
            {fieldErrors.name && <p className="host-org__field-error">{fieldErrors.name}</p>}
          </div>

          <div className="host-org__form-field">
            <label htmlFor="org-description">About</label>
            <textarea
              id="org-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={2000}
              rows={4}
              placeholder="Tell dancers about your organization…"
            />
            {fieldErrors.description && <p className="host-org__field-error">{fieldErrors.description}</p>}
          </div>

          <div className="host-org__form-field">
            <label htmlFor="org-type">Organization type</label>
            <select
              id="org-type"
              value={form.organizer_type}
              onChange={(e) => setForm({ ...form, organizer_type: e.target.value })}
            >
              <option value="">Select type…</option>
              {Object.entries(ORGANIZER_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {fieldErrors.organizer_type && <p className="host-org__field-error">{fieldErrors.organizer_type}</p>}
          </div>

          <div className="host-org__form-field">
            <label htmlFor="org-city">Primary city</label>
            <input
              id="org-city"
              type="text"
              value={form.primary_city}
              onChange={(e) => setForm({ ...form, primary_city: e.target.value })}
              maxLength={100}
              placeholder="e.g. Boston"
            />
          </div>

          <div className="host-org__form-field">
            <label htmlFor="org-website">Website</label>
            <input
              id="org-website"
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://"
            />
            {fieldErrors.website && <p className="host-org__field-error">{fieldErrors.website}</p>}
          </div>

          <div className="host-org__form-field">
            <label htmlFor="org-instagram">Instagram handle</label>
            <input
              id="org-instagram"
              type="text"
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              maxLength={100}
              placeholder="@handle"
            />
            {fieldErrors.instagram && <p className="host-org__field-error">{fieldErrors.instagram}</p>}
          </div>

          <div className="host-org__form-field">
            <label htmlFor="org-logo">Logo URL</label>
            <input
              id="org-logo"
              type="url"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://"
            />
            {fieldErrors.logo_url && <p className="host-org__field-error">{fieldErrors.logo_url}</p>}
          </div>

          <div className="host-org__form-actions">
            <button type="button" className="admin-btn admin-btn--secondary" onClick={cancelEditing}>
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
