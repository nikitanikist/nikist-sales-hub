import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

// Common timezones for the dropdown
export const COMMON_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST) - UTC+5:30' },
  { value: 'Asia/Dubai', label: 'Dubai (GST) - UTC+4' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT) - UTC+8' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST) - UTC+9' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
] as const;

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Convert a UTC date to the organization's timezone
 */
export function toOrgTime(date: Date | string, timezone: string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(dateObj, timezone);
}

/**
 * Convert a date in the organization's timezone to UTC
 */
export function fromOrgTime(date: Date, timezone: string): Date {
  return fromZonedTime(date, timezone);
}

/**
 * Format a date in the organization's timezone
 */
export function formatInOrgTime(
  date: Date | string, 
  timezone: string, 
  formatStr: string
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, timezone, formatStr);
}

/**
 * Get the timezone label for display
 */
export function getTimezoneLabel(timezoneValue: string): string {
  const found = COMMON_TIMEZONES.find(tz => tz.value === timezoneValue);
  return found?.label || timezoneValue;
}

/**
 * Get the short timezone abbreviation (e.g., "IST", "GST")
 */
export function getTimezoneAbbreviation(timezone: string): string {
  const abbreviations: Record<string, string> = {
    'Asia/Kolkata': 'IST',
    'Asia/Dubai': 'GST',
    'America/New_York': 'ET',
    'America/Los_Angeles': 'PT',
    'Europe/London': 'GMT',
    'Asia/Singapore': 'SGT',
    'Australia/Sydney': 'AEST',
    'Europe/Paris': 'CET',
    'Asia/Tokyo': 'JST',
    'America/Chicago': 'CT',
  };
  return abbreviations[timezone] || timezone;
}
