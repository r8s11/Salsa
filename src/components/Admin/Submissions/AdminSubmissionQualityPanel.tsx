import { TriangleAlert, CheckCircle } from "lucide-react";
import { QualityGap, QUALITY_ISSUE_LABEL } from "../../../features/admin/model/quality";
import "./AdminSubmissionQualityPanel.css";

interface AdminSubmissionQualityPanelProps {
  gaps: QualityGap[];
}

export default function AdminSubmissionQualityPanel({ gaps }: AdminSubmissionQualityPanelProps) {
  if (gaps.length === 0) {
    return (
      <div className="admin-submission-quality__panel--clean">
        <CheckCircle size={16} aria-hidden="true" />
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
        <TriangleAlert size={16} aria-hidden="true" />
        Quality Check ({gaps.length} issues)
      </h3>

      {required.length > 0 && (
        <section className="admin-submission-quality__section">
          <h4 className="admin-submission-quality__section-title admin-submission-quality__section-title--required">
            Required
          </h4>
          <ul className="admin-submission-quality__list">
            {required.map((gap) => (
              <li
                key={gap.issue}
                className="admin-submission-quality__item admin-submission-quality__item--required"
              >
                {QUALITY_ISSUE_LABEL[gap.issue]}
              </li>
            ))}
          </ul>
        </section>
      )}

      {recommended.length > 0 && (
        <section className="admin-submission-quality__section">
          <h4 className="admin-submission-quality__section-title admin-submission-quality__section-title--recommended">
            Recommended
          </h4>
          <ul className="admin-submission-quality__list">
            {recommended.map((gap) => (
              <li
                key={gap.issue}
                className="admin-submission-quality__item admin-submission-quality__item--recommended"
              >
                {QUALITY_ISSUE_LABEL[gap.issue]}
              </li>
            ))}
          </ul>
        </section>
      )}

      {optional.length > 0 && (
        <section className="admin-submission-quality__section">
          <h4 className="admin-submission-quality__section-title admin-submission-quality__section-title--optional">
            Optional
          </h4>
          <ul className="admin-submission-quality__list">
            {optional.map((gap) => (
              <li
                key={gap.issue}
                className="admin-submission-quality__item admin-submission-quality__item--optional"
              >
                {QUALITY_ISSUE_LABEL[gap.issue]}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
