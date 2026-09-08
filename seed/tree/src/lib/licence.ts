/**
 * The licence's expiry warning, in the words the kernel's CLI prints
 * (`identity.ExpiryWarningAt`, `BO_0208_008`, `BO_0213_010`): at 60, 30, 14,
 * 7 and 1 days before the expiry, and through the 30-day grace after it. A
 * surprise here is the licensor's fault, so the line is shown, not toasted.
 * BO_0209_005
 */

export const GRACE_DAYS = 30;
const MARKS: readonly number[] = [60, 30, 14, 7, 1];
const DAY_MS = 24 * 60 * 60 * 1000;

const dayOf = (at: Date): string => at.toISOString().slice(0, 10);

/**
 * The warning for a licence expiring at `expiresAt` (an RFC 3339 instant, or
 * nothing for an instance without a licence), read at `now`; `null` when
 * there is nothing to say.
 */
export function licenceWarning(expiresAt: string | null | undefined, now: Date): string | null {
  if (expiresAt === undefined || expiresAt === null || expiresAt === "") return null;
  const at = new Date(expiresAt);
  if (Number.isNaN(at.getTime())) return null;
  const day = dayOf(at);
  const graceEnd = at.getTime() + GRACE_DAYS * DAY_MS;
  if (now.getTime() > graceEnd) {
    return `the licence expired on ${day} and its grace has ended; every human other than the owner may stage but not establish`;
  }
  if (now.getTime() > at.getTime()) {
    const left = Math.floor((graceEnd - now.getTime()) / DAY_MS) + 1;
    return `the licence expired on ${day}; in grace, ${left} days left before every human other than the owner drops to staging`;
  }
  const left = Math.floor((at.getTime() - now.getTime()) / DAY_MS);
  return MARKS.includes(left) ? `the licence expires in ${left} days, on ${day}` : null;
}
