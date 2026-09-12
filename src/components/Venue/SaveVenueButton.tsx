import { Bookmark, BookmarkCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import { useAuth } from "../../contexts/useAuth";
import { useSavedVenues } from "../../features/venues/hooks/useSavedVenues";
import "./SaveButton.css";

interface SaveVenueButtonProps {
  venueId: string;
}

/**
 * Save/Unsave control for a venue. Reads saved state from the shared
 * saved-venues query cache and mutates through the same hook, so the
 * button stays in sync with the Saved Venues retrieval page.
 */
export default function SaveVenueButton({ venueId }: SaveVenueButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isSaved, save, unsave, isSaving, isUnsaving, saveError, unsaveError } = useSavedVenues();

  const saved = isSaved(venueId);
  const busy = isSaving || isUnsaving;
  const error = saved ? unsaveError : saveError;

  const handleClick = () => {
    if (!user) {
      // Follow the app's existing login flow — no return-URL support exists yet.
      navigate("/signin");
      return;
    }
    if (saved) unsave(venueId);
    else save(venueId);
  };

  return (
    <div className="save-venue-button">
      <Button
        variant={saved ? "secondary" : "primary"}
        size="compact"
        loading={busy}
        loadingLabel={saved ? "Removing…" : "Saving…"}
        onClick={handleClick}
        aria-pressed={saved}
      >
        {saved ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}
        {saved ? "Saved" : "Save"}
      </Button>
      {error && (
        <p className="save-venue-button__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
