import { TriangleAlert, CheckCircle } from "lucide-react";
import { QualityGap, QUALITY_ISSUE_LABEL } from "../../../features/admin/model/quality";

interface AdminSubmissionQualityPanelProps {
  gaps: QualityGap[];
}

export default function AdminSubmissionQualityPanel({ gaps }: AdminSubmissionQualityPanelProps) {
  if (gaps.length === 0) {
    return (
      <div className="admin-submission-quality__panel admin-submission-quality__panel--clean">
        <CheckCircle size={16} className="text-green-600" />
        <p>All information provided.</p>
      </div>
    );
  }

  const required = gaps.filter((g) => g.tier === "required");
  const recommended = gaps.filter((g) => g.tier === "recommended");
  const optional = gaps.filter((g) => g.tier === "optional");

  return (
    <div className="admin-submission-quality__panel">
      <h3 className="admin-submission-quality__title">
        <TriangleAlert size={16} />
        Quality Check ({gaps.length} issues)
      </h3>

      {required.length > 0 && (
        <section>
          <h4>Required</h4>
          <ul>
            {required.map((gap) => (
              <li key={gap.issue} className="text-red-600">{QUALITY_ISSUE_LABEL[gap.issue]}</li>
            ))}
          </ul>
        </section>
      )}

      {recommended.length > 0 && (
        <section>
          <h4>Recommended</h4>
          <ul>
            {recommended.map((gap) => (
              <li key={gap.issue}>{QUALITY_ISSUE_LABEL[gap.issue]}</li>
            ))}
          </ul>
        </section>
      )}

      {optional.length > 0 && (
        <section>
          <h4>Optional</h4>
          <ul>
            {optional.map((gap) => (
              <li key={gap.issue}>{QUALITY_ISSUE_LABEL[gap.issue]}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
