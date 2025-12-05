import { DateTime } from 'luxon';

export function toUtc(date: string, tz: string): string {
  return DateTime.fromISO(date, { zone: tz }).toUTC().toISO() || '';
}

export function fromUtc(isoUtc: string, tz: string): string {
  return DateTime.fromISO(isoUtc, { zone: 'utc' }).setZone(tz).toISO() || '';
}

export function formatInTimezone(isoUtc: string, tz: string, format: string = 'DD HH:mm'): string {
  return DateTime.fromISO(isoUtc, { zone: 'utc' }).setZone(tz).toFormat(format);
}

export function getCurrentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
