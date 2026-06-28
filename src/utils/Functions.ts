export function IsValidData(data: any) {
  if (data === null) {
    return false;
  }
  if (data === undefined) {
    return false;
  }
  if (typeof data === 'string' && data === '') {
    return false;
  }
  if (typeof data === 'boolean') {
    return data;
  }
  if (typeof data === 'object' && Object.keys(data).length === 0) {
    return false;
  }
  if (Array.isArray(data) && data.length === 0) {
    return false;
  }
  return true;
}

export function Debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, delay);
  };
}
