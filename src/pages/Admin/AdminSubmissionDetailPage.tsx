import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAdminSubmissions } from "../../hooks/useAdminSubmissions";
import "./AdminSubmissionDetailPage.css";

export default function AdminSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { submissions, isLoading, error } = useAdminSubmissions();

  const submission = useMemo(() => {
    return submissions?.find((s) => s.id === id);
  }, [submissions, id]);

  if (isLoading) return <div className="admin-submission-detail-page">Loading...</div>;
  if (error) return <div className="admin-submission-detail-page">Error loading submission.</div>;
  if (!submission) return <div className="admin-submission-detail-page">Submission not found.</div>;

  return (
    <div className="admin-submission-detail-page">
      <header className="admin-submission-detail-page__header">
        <button onClick={() => navigate("/admin/submissions")} className="admin-btn">
          &larr; Back to Submissions
        </button>
        <h1>Submission {submission.id}</h1>
      </header>
      <div className="admin-submission-detail-page__body">
        <section className="admin-card">
          <h2>Status: {submission.status}</h2>
          <p>Submitted by: {submission.submitter_name ?? submission.submitter_email}</p>
          <p>Submitted at: {new Date(submission.submitted_at).toLocaleString()}</p>
        </section>
        <section className="admin-card">
          <h3>Data</h3>
          <pre>{JSON.stringify(submission.submitted_data, null, 2)}</pre>
        </section>
      </div>
    </div>
  );
}
