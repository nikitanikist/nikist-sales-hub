import { useOrganization } from "@/hooks/useOrganization";
import { formatInOrgTime, toOrgTime, fromOrgTime, DEFAULT_TIMEZONE } from "@/lib/timezoneUtils";
import { startOfDay, endOfDay, subDays, addDays } from "date-fns";

/**
 * Hook that provides timezone-aware date utilities bound to the current organization's timezone.
 * All operations use the organization's configured timezone instead of the browser's local timezone.
 */
export function useOrgTimezone() {
  const { currentOrganization } = useOrganization();
  const timezone = currentOrganization?.timezone || DEFAULT_TIMEZONE;

  return {
    /** The organization's configured timezone (IANA identifier) */
    timezone,
    
    /**
     * Get "today" as a date string in the organization's timezone.
     * Use this for database filters that compare against "today".
     */
    getToday: () => formatInOrgTime(new Date(), timezone, 'yyyy-MM-dd'),
    
    /**
     * Get "yesterday" as a date string in the organization's timezone.
     */
    getYesterday: () => {
      const now = new Date();
      const yesterday = subDays(now, 1);
      return formatInOrgTime(yesterday, timezone, 'yyyy-MM-dd');
    },
    
    /**
     * Get "tomorrow" as a date string in the organization's timezone.
     */
    getTomorrow: () => {
      const now = new Date();
      const tomorrow = addDays(now, 1);
      return formatInOrgTime(tomorrow, timezone, 'yyyy-MM-dd');
    },
    
    /**
     * Format a date for display in the organization's timezone.
     * @param date - The date to format (UTC or local)
     * @param formatStr - date-fns format string (e.g., 'yyyy-MM-dd', 'MMM dd, yyyy')
     */
    format: (date: Date | string, formatStr: string) => 
      formatInOrgTime(date, timezone, formatStr),
    
    /**
     * Check if a given date is "today" in the organization's timezone.
     */
    isToday: (date: Date | string) => {
      const orgToday = formatInOrgTime(new Date(), timezone, 'yyyy-MM-dd');
      const dateStr = formatInOrgTime(date, timezone, 'yyyy-MM-dd');
      return orgToday === dateStr;
    },
    
    /**
     * Convert a UTC date to the organization's timezone.
     */
    toOrgTime: (date: Date | string) => toOrgTime(date, timezone),
    
    /**
     * Convert a date in the organization's timezone to UTC.
     */
    fromOrgTime: (date: Date) => fromOrgTime(date, timezone),
    
    /**
     * Get start of today in the organization's timezone (as UTC).
     * Useful for database range queries.
     */
    getStartOfToday: () => {
      const nowInOrg = toOrgTime(new Date(), timezone);
      return fromOrgTime(startOfDay(nowInOrg), timezone);
    },
    
    /**
     * Get end of today in the organization's timezone (as UTC).
     * Useful for database range queries.
     */
    getEndOfToday: () => {
      const nowInOrg = toOrgTime(new Date(), timezone);
      return fromOrgTime(endOfDay(nowInOrg), timezone);
    },
  };
}
