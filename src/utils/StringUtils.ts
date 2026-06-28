class StringUtils {
  // Convert string to title case
  static toTitleCase(str: string): string {
    if (!str) return '';
    return str.replace(
      /\w\S*/g,
      (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
  }

  // Check if a string is a palindrome
  static isPalindrome(str: string): boolean {
    if (!str) return false;
    const cleaned = str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return cleaned === cleaned.split('').reverse().join('');
  }

  // Truncate string to a specific length and append ellipsis
  static truncate(
    str: string,
    maxLength: number,
    ellipsis: string = '...'
  ): string {
    if (!str || str.length <= maxLength) return str;
    return str.slice(0, maxLength) + ellipsis;
  }

  // Reverse a string
  static reverse(str: string): string {
    if (!str) return '';
    return str.split('').reverse().join('');
  }

  // Count occurrences of a substring in a string
  static countOccurrences(str: string, substring: string): number {
    if (!str || !substring) return 0;
    return (str.match(new RegExp(substring, 'g')) || []).length;
  }

  // Remove spaces from a string
  static removeSpaces(str: string): string {
    if (!str) return '';
    return str.replace(/\s+/g, '');
  }

  // Capitalize the first letter of a string
  static capitalizeFirstLetter(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Check if a string contains only alphabets
  static isAlphabetic(str: string): boolean {
    return /^[a-zA-Z]+$/.test(str);
  }

  // Check if a string contains only digits
  static isNumeric(str: string): boolean {
    return /^[0-9]+$/.test(str);
  }

  // Check if a string is empty or contains only whitespace
  static isEmptyOrWhitespace(str: string): boolean {
    return !str || str.trim().length === 0;
  }

  static formatString(input: string): string {
    if (!input) return '';

    // Split camelCase into separate words and make them lowercase
    const spacedString = input
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase();

    // Capitalize the first letter of the entire string
    return spacedString.charAt(0).toUpperCase() + spacedString.slice(1) + '.';
  }

  static generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = (Math.random() * 16) | 0; // Generate a random number between 0 and 15
      const value = char === 'x' ? random : (random & 0x3) | 0x8; // Apply variant bit for 'y'
      return value.toString(16); // Convert to hexadecimal
    });
  };
}

export default StringUtils;
