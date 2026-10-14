import { Link, useNavigate } from "react-router-dom";
import AdminPageHeader from "../components/shell/AdminPageHeader";
import AdminVenueForm from "../components/venues/AdminVenueForm";
import { useAdminVenues } from "../hooks/useAdminVenues";
import "./AdminVenueCreatePage.css";

/** `/admin/venues/new`: one form in one card; a saved venue opens its record. */
export default function AdminVenueCreatePage() {
  const navigate = useNavigate();
  const { create, isCreating, createError } = useAdminVenues();

  return (
    <div className="admin-venue-create-page">
      <Link to="/admin/venues" className="admin-venue-create-page__back">← Venues</Link>
      <AdminPageHeader
        title="New venue"
        description="Add a venue record. Check the possible matches the form suggests before creating a duplicate."
      />
      <div className="admin-card admin-venue-create-page__card">
        <AdminVenueForm
          isSaving={isCreating}
          error={createError}
          onSubmit={(form) => create(form, { onSuccess: (venue) => navigate(`/admin/venues/${venue.id}`, { replace: true }) })}
          onCancel={() => navigate("/admin/venues")}
        />
      </div>
    </div>
  );
}
