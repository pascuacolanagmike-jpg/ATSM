/* ==================================================================== */
/*  src/lib/utils.ts                                                    */
/*  Complete helper module for the ICT12 Attendance System             */
/* ==================================================================== */

/* -------------------------------------------------------------------- */
/*  Class names                                                         */
/* -------------------------------------------------------------------- */

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/* -------------------------------------------------------------------- */
/*  Date / time                                                         */
/* -------------------------------------------------------------------- */

/**
 * Today's date as YYYY-MM-DD in the *local* timezone.
 * Do NOT use new Date().toISOString().slice(0, 10) — that returns UTC
 * and will be the wrong day for PH users before 8 AM.
 */
export function todayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format an ISO timestamp into "HH:MM AM/PM".
 * Returns "--" for null / invalid input.
 */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a date-only string (YYYY-MM-DD) or Date into "Mon D, YYYY".
 * Handles date-only strings by anchoring them at local midnight
 * so they don't shift a day in UTC-shifted timezones.
 */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '--';
  const d =
    typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)
      ? new Date(input + 'T00:00:00')
      : new Date(input as any);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Full timestamp: "Mon D, YYYY · HH:MM AM/PM".
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
  return (
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' · ' +
    d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  );
}

/** true if the given time (defaults to now) is before noon. */
export function isAM(date: Date = new Date()): boolean {
  return date.getHours() < 12;
}

/**
 * Duration between two ISO timestamps as "Xh Ym" (or "Ym" if < 1 hour).
 * Returns "--" for missing / invalid / inverted inputs.
 * Example: calculateDuration(record.time_in_am, record.time_out_am)
 */
export function calculateDuration(
  startIso: string | null | undefined,
  endIso: string | null | undefined
): string {
  if (!startIso || !endIso) return '--';

  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return '--';

  const totalMinutes = Math.floor((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/* -------------------------------------------------------------------- */
/*  Attendance — present / late cutoff                                  */
/* -------------------------------------------------------------------- */

export const AM_CUTOFF_HOUR = 8;
export const AM_CUTOFF_MINUTE = 15;
export const PM_CUTOFF_HOUR = 13;
export const PM_CUTOFF_MINUTE = 15;

/**
 * Decide whether a scan counts as "present" or "late".
 * After 8:15 AM (AM session) or after 1:15 PM (PM session) → late.
 * Adjust the CUTOFF_* constants above to change the thresholds.
 */
export function statusForScan(
  now: Date,
  session: 'AM' | 'PM'
): 'present' | 'late' {
  const cutoff = new Date(now);
  if (session === 'AM') {
    cutoff.setHours(AM_CUTOFF_HOUR, AM_CUTOFF_MINUTE, 0, 0);
  } else {
    cutoff.setHours(PM_CUTOFF_HOUR, PM_CUTOFF_MINUTE, 0, 0);
  }
  return now > cutoff ? 'late' : 'present';
}

/* -------------------------------------------------------------------- */
/*  Attendance — badge helpers                                          */
/* -------------------------------------------------------------------- */

/**
 * Tailwind classes for a status badge.
 *   <span className={getStatusColor(record.status)}>…</span>
 */
export function getStatusColor(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'present':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'late':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'absent':
      return 'bg-red-50 text-red-700 border border-red-200';
    case 'excused':
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-200';
  }
}

/** Title-case label for a status, e.g. "late" → "Late". */
export function getStatusLabel(status: string): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/** Tailwind classes for the AM / PM session pill. */
export function getSessionColor(session: 'AM' | 'PM'): string {
  return session === 'AM'
    ? 'bg-amber-50 text-amber-700 border border-amber-200'
    : 'bg-indigo-50 text-indigo-700 border border-indigo-200';
}

/** Tailwind classes for the "face" vs "manual" vs "excel" method tag. */
export function getMethodColor(method: string): string {
  switch ((method || '').toLowerCase()) {
    case 'face':
      return 'bg-purple-50 text-purple-700 border border-purple-200';
    case 'manual':
      return 'bg-gray-100 text-gray-600 border border-gray-200';
    case 'excel':
      return 'bg-teal-50 text-teal-700 border border-teal-200';
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-200';
  }
}

/* -------------------------------------------------------------------- */
/*  Percentage helpers (for dashboard tiles)                            */
/* -------------------------------------------------------------------- */

/**
 * present / total as a rounded percentage. Safe when total is 0.
 * Example: percent(28, 30) → 93
 */
export function percent(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/* -------------------------------------------------------------------- */
/*  Phone number normalization (PH)                                     */
/* -------------------------------------------------------------------- */

/**
 * Normalize a Philippine phone number to E.164 (+63XXXXXXXXXX).
 * Accepts: 09123456789, 9123456789, +639123456789, 63 912 345 6789.
 * Returns null if it can't be normalized.
 */
export function toE164(phone: string): string | null {
  if (!phone) return null;
  const raw = phone.trim();
  if (/^\+63\d{10}$/.test(raw)) return raw;

  const digits = raw.replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return '+63' + digits.slice(1);
  if (/^9\d{9}$/.test(digits)) return '+63' + digits;
  if (/^63\d{10}$/.test(digits)) return '+' + digits;
  return null;
}