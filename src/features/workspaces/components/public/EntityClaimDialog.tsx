import { useId, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccessibleDialog } from "../../../../shared/a11y/useAccessibleDialog";
import { submitEntityClaim } from "../../api/workspacesRepo";
import { MY_ENTITY_CLAIMS_KEY } from "../../hooks/useMyEntityMemberships";
import {
  CLAIM_RELATIONSHIP_LABELS,
  type ClaimRelationship,
  type ManagedKind,
} from "../../model";
import "./EntityClaimDialog.css";

interface EntityClaimDialogProps {
  kind: ManagedKind;
  entity: { id: string; name: string; slug: string };
  isOpen: boolean;
  onClose: () => void;
}

const INSTRUCTOR_RELATIONSHIPS: readonly ClaimRelationship[] = ["self", "manager"];
const ORGANIZATION_RELATIONSHIPS: readonly ClaimRelationship[] = ["owner", "manager", "staff"];

export function EntityClaimDialog({
  kind,
  entity,
  isOpen,
  onClose,
}: EntityClaimDialogProps) {
  const queryClient = useQueryClient();
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const initialRelationship: ClaimRelationship = kind === "instructor" ? "self" : "owner";
  const [relationship, setRelationship] = useState<ClaimRelationship>(initialRelationship);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    onDismiss: onClose,
    isBusy: isSubmitting,
    isOpen,
  });

  if (!isOpen) return null;

  const availableRelationships =
    kind === "instructor" ? INSTRUCTOR_RELATIONSHIPS : ORGANIZATION_RELATIONSHIPS;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await submitEntityClaim(kind, entity.id, relationship, message.trim());
      await queryClient.invalidateQueries({ queryKey: [MY_ENTITY_CLAIMS_KEY] });
      setIsSuccess(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to submit claim. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="entity-claim-dialog__overlay" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="entity-claim-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        onClick={onDialogClick}
      >
        <header className="entity-claim-dialog__header">
          <h2 id={titleId}>Claim {entity.name}</h2>
          <p className="entity-claim-dialog__subtitle">
            {kind === "instructor"
              ? "Verify your profile to manage your artist bio and schedule."
              : `Submit a claim to manage this ${kind}'s profile, team, and offerings.`}
          </p>
        </header>

        {isSuccess ? (
          <div className="entity-claim-dialog__success" role="status">
            <h3 className="entity-claim-dialog__success-title">Claim submitted</h3>
            <p className="entity-claim-dialog__success-message">
              Your claim is waiting for review.
            </p>
            <div className="entity-claim-dialog__actions">
              <button
                type="button"
                className="ui-button ui-button--primary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form className="entity-claim-dialog__form" onSubmit={handleSubmit}>
            <fieldset className="entity-claim-dialog__fieldset" disabled={isSubmitting}>
              <legend className="entity-claim-dialog__legend">Your relationship</legend>
              <div className="entity-claim-dialog__radios">
                {availableRelationships.map((rel) => (
                  <label key={rel} className="entity-claim-dialog__radio-label">
                    <input
                      type="radio"
                      name="claim-relationship"
                      value={rel}
                      checked={relationship === rel}
                      onChange={() => setRelationship(rel)}
                      disabled={isSubmitting}
                    />
                    <span className="entity-claim-dialog__radio-text">
                      {CLAIM_RELATIONSHIP_LABELS[rel]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="entity-claim-dialog__field">
              <label htmlFor={messageId} className="entity-claim-dialog__label">
                Message (optional)
              </label>
              <textarea
                id={messageId}
                className="entity-claim-dialog__textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                maxLength={2000}
                rows={4}
                placeholder="Include details that can help our team verify your affiliation..."
                disabled={isSubmitting}
              />
              <span className="entity-claim-dialog__char-count">{message.length}/2000</span>
            </div>

            {errorMessage && (
              <p className="entity-claim-dialog__error" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="entity-claim-dialog__actions">
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ui-button ui-button--primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting…" : "Submit claim"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
