/** 10-Aug-2026 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '-');
}

/** ORG-00001 → 0001 | USR-00006 → 0006 */
export function formatId(refId: string | null | undefined): string {
  if (!refId) return '—';
  const num = parseInt(refId.split('-')[1] ?? '0', 10);
  return String(num).padStart(4, '0');
}
