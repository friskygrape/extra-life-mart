export const DAYS_PER_WEEK = 7;
export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** Day 1 is the Monday of week 1. */
export const weekOf = (day: number) => Math.floor((day - 1) / DAYS_PER_WEEK) + 1;
export const weekdayIndex = (day: number) => (day - 1) % DAYS_PER_WEEK;
export const weekdayName = (day: number) => WEEKDAYS[weekdayIndex(day)];

/** Rent comes out when Sunday closes. */
export const isRentDay = (day: number) => weekdayIndex(day) === DAYS_PER_WEEK - 1;
export const daysUntilRent = (day: number) => DAYS_PER_WEEK - 1 - weekdayIndex(day);

/** The calendar's one-line heading, tightening up as the week number grows so it always fits. */
export function calendarHeading(day: number): string {
  const week = weekOf(day);
  if (week < 10) return `${weekdayName(day)} W${week}`;
  return week < 100 ? `${weekdayName(day)} ${week}` : weekdayName(day);
}
