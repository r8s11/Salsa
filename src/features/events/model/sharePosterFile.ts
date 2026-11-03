export type PosterShareOutcome = "shared" | "dismissed" | "needs_fresh_tap" | "failed" | "unsupported";

/**
 * Hands a poster PNG to the native share sheet with the URL as both a URL and
 * text value, so share targets can make it tappable while keeping the image.
 * Never downloads on its own: `unsupported` tells the caller to fall back.
 */
export async function sharePosterFile(input: {
  blob: Blob;
  filename: string;
  title: string;
  url: string;
}): Promise<PosterShareOutcome> {
  const file = new File([input.blob], input.filename, { type: "image/png" });
  const shareData = {
    files: [file],
    title: input.title,
    text: `${input.title} — ${input.url}`,
    url: input.url,
  };

  if (!navigator.canShare?.(shareData)) return "unsupported";
  try {
    await navigator.share(shareData);
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "dismissed";
    if (err instanceof DOMException && err.name === "NotAllowedError") return "needs_fresh_tap";
    return "failed";
  }
}
