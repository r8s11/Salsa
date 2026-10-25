import { useCallback, useEffect, useRef, useState } from "react";
import type { FlyerItem } from "../../events/components/EventFlyersField";
import { MAX_FLYERS_PER_EVENT } from "../../events/model/eventFlyers";

/**
 * One slot in the host's ordered flyer list: an already-stored flyer (`file`
 * null, `url` is its public URL) or a file chosen locally that is uploaded on
 * save (`url` is only a local preview).
 */
export type HostFlyerEntry = { id: string; url: string; file: File | null };

function previewFor(file: File): string {
  return typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "";
}

function revoke(entry: HostFlyerEntry) {
  if (entry.file && entry.url && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(entry.url);
  }
}

/**
 * Ordered flyer selection for the host forms. Position 0 is the primary flyer.
 * Files stay local until the form is saved; nothing here touches storage.
 */
export function useHostFlyers(initialUrls: readonly string[] = []) {
  const [entries, setEntries] = useState<HostFlyerEntry[]>(() =>
    initialUrls.map((url) => ({ id: url, url, file: null }))
  );
  const latest = useRef(entries);
  const counter = useRef(0);
  useEffect(() => {
    latest.current = entries;
  }, [entries]);
  useEffect(
    () => () => {
      latest.current.forEach(revoke);
    },
    []
  );

  const reset = useCallback((urls: readonly string[]) => {
    latest.current.forEach(revoke);
    setEntries(urls.map((url) => ({ id: url, url, file: null })));
  }, []);

  const addFiles = useCallback((files: File[]) => {
    setEntries((current) => {
      const room = MAX_FLYERS_PER_EVENT - current.length;
      const added = files.slice(0, Math.max(0, room)).map((file) => ({
        id: `pending-${counter.current++}`,
        url: previewFor(file),
        file,
      }));
      return [...current, ...added];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((current) => {
      const gone = current.find((entry) => entry.id === id);
      if (gone) revoke(gone);
      return current.filter((entry) => entry.id !== id);
    });
  }, []);

  const move = useCallback((id: string, direction: "earlier" | "later") => {
    setEntries((current) => {
      const from = current.findIndex((entry) => entry.id === id);
      const to = direction === "earlier" ? from - 1 : from + 1;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }, []);

  const items: FlyerItem[] = entries.map((entry) => ({ id: entry.id, url: entry.url }));

  return { entries, items, addFiles, remove, move, reset };
}

/** Stored flyer URLs in their current order (local files excluded). */
export function storedFlyerUrls(entries: readonly HostFlyerEntry[]): string[] {
  return entries.filter((entry) => !entry.file).map((entry) => entry.url);
}

/** The full ordered URL list once each local file has been uploaded, in order. */
export function finalFlyerUrls(
  entries: readonly HostFlyerEntry[],
  uploadedUrls: readonly string[]
): string[] {
  let next = 0;
  return entries.map((entry) => (entry.file ? uploadedUrls[next++] : entry.url));
}
