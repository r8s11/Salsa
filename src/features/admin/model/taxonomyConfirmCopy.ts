export function taxonomyArchiveCopy(name: string) {
  return {
    title: `Archive “${name}”?`,
    body: `It will be removed from active selection while existing relationships and historical events keep the term.`,
    confirmLabel: "Archive Term",
    busyLabel: "Archiving…",
    tone: "neutral" as const,
  };
}

export function taxonomyDeleteCopy(name: string) {
  return {
    title: `Delete “${name}”?`,
    body: `This permanently deletes “${name}”. It is only possible because the term is unused.`,
    confirmLabel: "Delete Term",
    busyLabel: "Deleting…",
    tone: "danger" as const,
  };
}
