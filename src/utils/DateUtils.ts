export class DateUtils {
  /**
   * Formats a given date object or ISO string to the specified format.
   * Default format: YYYY-MM-DD
   */
  static formatDate(date: Date | string, format: string = 'YYYY-MM-DD'): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    const map: {[key: string]: string} = {
      YYYY: d.getFullYear().toString(),
      MM: String(d.getMonth() + 1).padStart(2, '0'),
      DD: String(d.getDate()).padStart(2, '0'),
      HH: String(d.getHours()).padStart(2, '0'),
      mm: String(d.getMinutes()).padStart(2, '0'),
      ss: String(d.getSeconds()).padStart(2, '0'),
    };

    return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => map[match]);
  }

  /**
   * Returns the difference between two dates in the specified unit.
   * Supported units: days, hours, minutes, seconds
   */
  static getDateDifference(
    date1: Date | string,
    date2: Date | string,
    unit: 'days' | 'hours' | 'minutes' | 'seconds' = 'days',
  ): number {
    const d1 = new Date(date1).getTime();
    const d2 = new Date(date2).getTime();

    const diffInMs = Math.abs(d1 - d2);
    switch (unit) {
      case 'days':
        return diffInMs / (1000 * 60 * 60 * 24);
      case 'hours':
        return diffInMs / (1000 * 60 * 60);
      case 'minutes':
        return diffInMs / (1000 * 60);
      case 'seconds':
        return diffInMs / 1000;
      default:
        throw new Error('Unsupported unit');
    }
  }

  /**
   * Checks if a given date is today.
   */
  static isToday(date: Date | string): boolean {
    const d = new Date(date);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
    );
  }

  /**
   * Adds or subtracts the specified amount of time to/from a given date.
   * Supported units: days, hours, minutes, seconds
   */
  static addTime(date: Date | string, amount: number, unit: 'days' | 'hours' | 'minutes' | 'seconds'): Date {
    const d = new Date(date);
    switch (unit) {
      case 'days':
        d.setDate(d.getDate() + amount);
        break;
      case 'hours':
        d.setHours(d.getHours() + amount);
        break;
      case 'minutes':
        d.setMinutes(d.getMinutes() + amount);
        break;
      case 'seconds':
        d.setSeconds(d.getSeconds() + amount);
        break;
      default:
        throw new Error('Unsupported unit');
    }
    return d;
  }

  /**
   * Checks if a date falls within a specific range.
   */
  static isDateInRange(date: Date | string, start: Date | string, end: Date | string): boolean {
    const d = new Date(date).getTime();
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();

    return d >= s && d <= e;
  }

  /**
   * Converts a date to a relative date string ("Today", "Yesterday", or formatted date).
   * @param date - The date to convert.
   */
  static toRelativeDate(date: Date | string): string {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    if (isSameDay(d, today)) {
      return 'Today';
    } else if (isSameDay(d, yesterday)) {
      return 'Yesterday';
    } else {
      // Format the date as "Month Day, Year"
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      };
      return d.toLocaleDateString(undefined, options);
    }
  }

  static formatTime(dateString: string | Date): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }); // e.g., 03:45 PM
  }

  /**
   * Converts a date to a human-readable format like "just now", "10 seconds ago", etc. Also handle the date, today, Yesterday, 1 year ago, July 16, 2025
   */
  static toHumanReadable(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();

    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffInSeconds < 0) {
      // Future date
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    if (diffInSeconds < 10) {
      return 'just now';
    }
    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
    }

    // Check for today
    if (DateUtils.isToday(d)) {
      return `Today at ${DateUtils.formatTime(d)}`;
    }

    // Check for yesterday
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate()
    ) {
      return `Yesterday at ${DateUtils.formatTime(d)}`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
    }

    const diffInMonths = now.getFullYear() * 12 + now.getMonth() - (d.getFullYear() * 12 + d.getMonth());
    if (diffInMonths < 12) {
      return diffInMonths === 1 ? '1 month ago' : `${diffInMonths} months ago`;
    }

    const diffInYears = now.getFullYear() - d.getFullYear();
    if (diffInYears >= 1) {
      return diffInYears === 1 ? '1 year ago' : `${diffInYears} years ago`;
    }

    // Fallback to formatted date
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
