export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 21;
const DUSK_START = 18;
const NIGHT_START = 19.5;

/** The hour of the day (with fractions), given how far through the day we are from 0 to 1. */
export function hourOfDay(fraction: number): number {
  return OPEN_HOUR + Math.min(1, Math.max(0, fraction)) * (CLOSE_HOUR - OPEN_HOUR);
}

/** A 12-hour clock to the minute, such as 9:00 AM or 12:37 PM. */
export function clockLabel(fraction: number): string {
  const minutes = Math.floor(hourOfDay(fraction) * 60);
  const hour24 = Math.floor(minutes / 60);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minutes % 60).padStart(2, '0')} ${hour24 < 12 ? 'AM' : 'PM'}`;
}

/** How strongly the dusk and night scenes show. Bright until 6 PM, then fading to full night by 9 PM. */
export function lightingAt(fraction: number): { dusk: number; night: number } {
  const hour = hourOfDay(fraction);
  const dusk = Math.min(1, Math.max(0, (hour - DUSK_START) / (NIGHT_START - DUSK_START)));
  const night = Math.min(1, Math.max(0, (hour - NIGHT_START) / (CLOSE_HOUR - NIGHT_START)));
  return { dusk, night };
}
