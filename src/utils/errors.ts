/** Map internal failures to human-readable, non-technical messages. */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/decode|load/i.test(msg)) {
    return 'That file could not be read as an image. Try a different photo (JPG, PNG or WebP).';
  }
  if (/memory|allocation|quota|too large/i.test(msg)) {
    return 'This photo is too large for the browser to process. Try a smaller copy.';
  }
  if (/canvas|tainted/i.test(msg)) {
    return 'Image processing failed in this browser. Try updating to a recent version.';
  }
  if (/export|blob/i.test(msg)) {
    return 'Export failed while encoding the image. Please try again.';
  }
  if (/timeout/i.test(msg)) {
    return 'Processing took too long and was stopped. Try a smaller photo.';
  }
  return 'Something went wrong while processing your photo. Please try again.';
}
