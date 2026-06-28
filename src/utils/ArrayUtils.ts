class ArrayUtils {
  /**
   * Group an array of objects by a specific property.
   * @param array The array to group.
   * @param property The property to group by.
   * @returns An object where the keys are the property values, and the values are arrays of objects with that property.
   */
  static groupBy<T extends Record<string, any>>(
    array: T[],
    property: keyof T
  ): Record<string, T[]> {
    return array.reduce(
      (result, item) => {
        const key = item[property] as string;
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(item);
        return result;
      },
      {} as Record<string, T[]>
    );
  }

  /**
   * Remove duplicates from an array.
   * @param array The array to remove duplicates from.
   * @returns A new array with unique values.
   */
  static removeDuplicates<T>(array: T[]): T[] {
    return Array.from(new Set(array));
  }

  /**
   * Find the intersection of two arrays.
   * @param array1 The first array.
   * @param array2 The second array.
   * @returns An array containing elements present in both arrays.
   */
  static intersection<T>(array1: T[], array2: T[]): T[] {
    return array1.filter((item) => array2.includes(item));
  }

  /**
   * Flatten a multi-dimensional array into a single-dimensional array.
   * @param array The multi-dimensional array.
   * @returns A flattened array.
   */
  static flatten<T>(array: T[][]): T[] {
    return array.reduce((flat, current) => flat.concat(current), []);
  }

  /**
   * Shuffle an array.
   * @param array The array to shuffle.
   * @returns A new array with the elements shuffled.
   */
  static shuffle<T>(array: T[]): T[] {
    return array
      .map((value) => ({ value, sortKey: Math.random() }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ value }) => value);
  }

  static groupByDate<T extends Record<string, any>>(
    items: T[],
    dateField: keyof T,
    options?: {
      order?: 'asc' | 'desc';
      useFormattedDate?: boolean;
      locale?: string;
      dateOptions?: Intl.DateTimeFormatOptions;
    }
  ): { title: string; data: T[] }[] {
    const {
      order = 'asc',
      useFormattedDate = false,
      locale = 'en-US',
      dateOptions = { year: 'numeric', month: 'short', day: 'numeric' },
    } = options || {};

    const formatter = new Intl.DateTimeFormat(locale, dateOptions);

    const sorted = [...items].sort((a, b) => {
      const aTime = new Date(a[dateField] as string).getTime();
      const bTime = new Date(b[dateField] as string).getTime();
      return order === 'asc' ? aTime - bTime : bTime - aTime;
    });

    const grouped = sorted.reduce(
      (acc, item) => {
        const dateObj = new Date(item[dateField] as string);
        const dateKey = useFormattedDate
          ? formatter.format(dateObj)
          : (dateObj.toISOString().split('T')[0] ?? dateObj.toISOString());

        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(item);
        return acc;
      },
      {} as Record<string, T[]>
    );

    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }
}

export default ArrayUtils;
