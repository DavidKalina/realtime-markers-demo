/**
 * Aggressively filters out expired events client-side.
 * This is a defensive layer on top of backend filtering to handle cached data.
 *
 * An event is considered active if:
 * - It is a recurring event (recurring events never expire), OR
 * - It has an endDate in the future, OR
 * - It has no endDate and its eventDate is in the future or now
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filterExpiredEvents<T extends Record<string, any>>(
  events: T[],
): T[] {
  const now = new Date();
  return events.filter((e) => {
    if (e.isRecurring) return true;
    const end = e.endDate ? new Date(e.endDate) : null;
    if (end) return end > now;
    return new Date(e.eventDate) >= now;
  });
}
