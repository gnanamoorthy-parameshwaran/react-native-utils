class CurrencyUtil {
  /**
   * Convert a number to a currency string.
   * @param amount The amount to convert.
   * @param currency The currency code (default is 'INR').
   * @param locale The locale code (default is 'en-IN').
   * @returns The formatted currency string.
   */
  static format(amount: number, currency = 'INR', locale = 'en-IN'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Parse a formatted currency string back to a number.
   * @param formattedAmount The formatted currency string.
   * @param locale The locale code (default is 'en-IN').
   * @returns The parsed number.
   */
  static parse(formattedAmount: string, locale = 'en-IN'): number {
    const example = CurrencyUtil.format(1, 'USD', locale);
    const cleanString = formattedAmount
      .replace(new RegExp(`[^0-9${example.charAt(1)}]`, 'g'), '')
      .replace(example.charAt(1), '.');
    return parseFloat(cleanString) || 0;
  }
}

export default CurrencyUtil;
