/** Hours + minutes form value; always converted to integer minutes. */
export interface DurationValue {
  hours: string;
  minutes: string;
}

export function durationFromMinutes(total: number | null): DurationValue {
  if (total === null) {
    return { hours: '', minutes: '' };
  }
  return { hours: String(Math.floor(total / 60)), minutes: String(total % 60) };
}
