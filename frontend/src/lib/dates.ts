// Bounds for birth/death date inputs, matching the backend check
// (backend/src/api/profile/dto/date-range.ts): year 1000 up to today.
export const MIN_PROFILE_DATE = '1000-01-01';

// Today in the user's local time, as YYYY-MM-DD (what <input type="date"> uses).
export function todayDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
