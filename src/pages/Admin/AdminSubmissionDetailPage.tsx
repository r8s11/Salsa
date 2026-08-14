import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useActiveTaxonomyTerms } from "../../features/admin/hooks/useAdminTaxonomy";
import { useAdminSubmissions } from "../../hooks/useAdminSubmissions";
import "./AdminSubmissionDetailPage.css";

export default function AdminSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [taxonomyTermIds, setTaxonomyTermIds] = useState<string[]>([]);
  const { submissions, isLoading, error, approveSubmissionWithTaxonomy, isApproving, approveError } = useAdminSubmissions();
  const danceStyles = useActiveTaxonomyTerms("dance_style");
  const submission = useMemo(() => submissions.find((item) => item.id === id), [submissions, id]);

  if (isLoading) return <div className="admin-submission-detail-page">Loading...</div>;
  if (error) return <div className="admin-submission-detail-page" role="alert">Error loading submission.</div>;
  if (!submission) return <div className="admin-submission-detail-page">Submission not found.</div>;

  const rawStyles = Array.isArray(submission.submitted_data.dance_styles)
    ? submission.submitted_data.dance_styles.filter((style): style is string => typeof style === "string")
    : [];
  const toggleTerm = (termId: string) => setTaxonomyTermIds((current) =>
    current.includes(termId) ? current.filter((id) => id !== termId) : [...current, termId],
  );
  const approve = () => {
    approveSubmissionWithTaxonomy(
      { submissionId: submission.id, taxonomyTermIds },
      { onSuccess: () => navigate("/admin/submissions") },
    );
  };

  return (
    <div className="admin-submission-detail-page">
      <header className="admin-submission-detail-page__header">
        <button type="button" onClick={() => navigate("/admin/submissions")} className="admin-btn">&larr; Back to Submissions</button>
        <h1>Submission {submission.id}</h1>
      </header>
      <div className="admin-submission-detail-page__body">
        <section className="admin-card">
          <h2>Status: {submission.status}</h2>
          <p>Submitted by: {submission.submitter_name ?? submission.submitter_email}</p>
          <p>Submitted at: {new Date(submission.submitted_at).toLocaleString()}</p>
        </section>
        <section className="admin-card">
          <h2>Submitted source</h2>
          {rawStyles.length > 0 ? <ul>{rawStyles.map((style) => <li key={style}>{style}</li>)}</ul> : <p>No dance styles were supplied</p>}
          <pre>{JSON.stringify(submission.submitted_data, null, 2)}</pre>
        </section>
        {submission.edited_data && <section className="admin-card"><h2>Moderator edits</h2><pre>{JSON.stringify(submission.edited_data, null, 2)}</pre></section>}
        <fieldset className="admin-card">
          <legend>Canonical dance styles</legend>
          {danceStyles.isLoading ? <p>Loading dance styles…</p> : danceStyles.error ? <p role="alert">{danceStyles.error}</p> : danceStyles.terms.length === 0 ? <p>No active dance styles available</p> : danceStyles.terms.map((term) => (
            <label key={term.id}><input type="checkbox" checked={taxonomyTermIds.includes(term.id)} onChange={() => toggleTerm(term.id)} />{term.name}</label>
          ))}
        </fieldset>
        {approveError && <p role="alert">{approveError instanceof Error ? approveError.message : "Approval failed"}</p>}
        <button type="button" className="admin-btn admin-btn--primary" disabled={isApproving || danceStyles.isLoading} onClick={approve}>
          {isApproving ? "Approving…" : "Approve submission"}
        </button>
      </div>
    </div>
  );
}
