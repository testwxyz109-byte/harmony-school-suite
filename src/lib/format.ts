export function fullName(s: { first_name: string; middle_name?: string | null; last_name: string }) {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

export function money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export function gradeFor(percentage: number) {
  if (percentage >= 90) return "A";
  if (percentage >= 80) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 60) return "D";
  return "F";
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
