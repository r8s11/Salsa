import { useEffect, useState } from "react";
import { searchVenues } from "../api/venuesRepo";
import type { VenueRow } from "../model/venuesQuery";
import { venueDisplayAddress } from "../model/venuesQuery";

/**
 * Lightweight combobox hook for venue search.
 *
 * - Debounces API calls by 200ms (matches AdminVenuesToolbar search pattern).
 * - Returns the selected venue + the matching results for the dropdown.
 * - `selectVenue` is called when the user picks a venue from the list.
 * - `clearVenue` resets the selection (sets venue_id back to "").
 */
export function useVenueCombobox(initialValue: string = "") {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(initialValue);
  const [selectedName, setSelectedName] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");

  useEffect(() => {
    if (!query.trim()) {
      return;
    }
    const timer = setTimeout(() => {
      searchVenues(query, 10)
        .then(setResults)
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const selectVenue = (venue: VenueRow) => {
    setSelectedId(venue.id);
    setSelectedName(venue.name);
    setSelectedAddress(venueDisplayAddress(venue) || "");
    setQuery("");
    setIsOpen(false);
  };

  const clearVenue = () => {
    setSelectedId("");
    setSelectedName("");
    setSelectedAddress("");
    setQuery("");
  };

  return {
    query,
    setQuery,
    results,
    isOpen,
    setIsOpen,
    selectedId,
    selectedName,
    selectedAddress,
    selectVenue,
    clearVenue,
    venueDisplayAddress,
  };
}
