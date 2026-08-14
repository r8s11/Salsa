import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSubmissionsTable, {
  type SubmissionRowAction,
} from "../../components/Admin/AdminSubmissionsTable";
import AdminSubmissionsFilterDrawer, {
  type SubmissionFilters,
} from "../../components/Admin/AdminSubmissionsFilterDrawer";
import { useAdminSubmissions } from "../../hooks/useAdminSubmissions";
import { type EventSubmission } from "../../features/admin/model/submissions";
import "../../styles/admin.css";

export default function AdminSubmissionsPage() {
  const navigate = useNavigate();
  const { submissions, isLoading, updateSubmission } = useAdminSubmissions();
  const [filters, setFilters] = useState<SubmissionFilters>({ status: null, submitter_name: null });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleAction = (action: SubmissionRowAction, submission: EventSubmission) => {
    switch (action) {
      case "approve":
        navigate(`/admin/submissions/${submission.id}`);
        break;
      case "reject":
        updateSubmission({ id: submission.id, update: { status: "rejected" } });
        break;
      case "view":
        navigate(`/admin/submissions/${submission.id}`);
        break;
    }
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (filters.status && s.status !== filters.status) return false;
    if (filters.submitter_name && s.submitter_name !== filters.submitter_name) return false;
    return true;
  });

  return (
    <div className="admin-submissions-page">
      <h1>Submissions</h1>
      <button onClick={() => setDrawerOpen(true)}>Filters</button>
      
      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <AdminSubmissionsTable 
          submissions={filteredSubmissions} 
          onAction={handleAction} 
        />
      )}

      <AdminSubmissionsFilterDrawer
        open={drawerOpen}
        submissions={submissions}
        filters={filters}
        onFiltersChange={setFilters}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
