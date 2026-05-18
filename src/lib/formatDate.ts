/**
 * Format an ISO date string as a human-readable label.
 * Returns an empty string if the input is falsy or unparseable.
 */
export function formatDateLabel(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return '';
  }
}
