class ValidationUtils {
  Date(field: string, value: any) {
    const isValid = !isNaN(Date.parse(value));
    return {
      isValid,
      message: isValid ? null : `The ${field} is not a valid date`,
    };
  }

  DateEquals(field: string, compare: string, value: any) {
    const isValid =
      new Date(value).toISOString() === new Date(compare).toISOString();
    return {
      isValid,
      message: isValid ? null : `The ${field} must be equal to ${compare}`,
    };
  }

  DateFormat(field: string, format: string, value: any) {
    // Simple format check (YYYY-MM-DD, etc.)
    // For more complex formats, use a date-fns or moment parser
    let regex;
    switch (format) {
      case 'YYYY-MM-DD':
        regex = /^\d{4}-\d{2}-\d{2}$/;
        break;
      case 'YYYY-MM-DD HH:mm:ss':
        regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        break;
      default:
        regex = null;
    }
    const isValid = regex ? regex.test(value) : true;
    return {
      isValid,
      message: isValid
        ? null
        : `The ${field} does not match the format ${format}`,
    };
  }

  After(field: string, compare: string, value: any) {
    const isValid = new Date(value) > new Date(compare);
    return {
      isValid,
      message: isValid ? null : `The ${field} must be after ${compare}`,
    };
  }

  AfterOrEqual(field: string, compare: string, value: any) {
    const isValid = new Date(value) >= new Date(compare);
    return {
      isValid,
      message: isValid
        ? null
        : `The ${field} must be after or equal to ${compare}`,
    };
  }

  Before(field: string, compare: string, value: any) {
    const isValid = new Date(value) < new Date(compare);
    return {
      isValid,
      message: isValid ? null : `The ${field} must be before ${compare}`,
    };
  }

  BeforeOrEqual(field: string, compare: string, value: any) {
    const isValid = new Date(value) <= new Date(compare);
    return {
      isValid,
      message: isValid
        ? null
        : `The ${field} must be before or equal to ${compare}`,
    };
  }

  Different(field: string, compareField: string, value: any, fields?: any) {
    const isValid = value !== (fields ? fields[compareField] : compareField);
    return {
      isValid,
      message: isValid
        ? null
        : `The ${field} must be different from ${compareField}`,
    };
  }

  Timezone(field: string, tz: string, value: any) {
    // Basic check for timezone string
    const isValid = typeof value === 'string' && value === tz;
    return {
      isValid,
      message: isValid ? null : `The ${field} must be in timezone ${tz}`,
    };
  }
  In(field: string, values: string[], value: any) {
    const isValid = values.includes(String(value));
    return {
      isValid,
      message: isValid
        ? null
        : `The ${field} must be one of: ${values.join(', ')}`,
    };
  }
  Required(field: string, value: any) {
    const isValid =
      value !== undefined &&
      value !== null &&
      !(typeof value === 'string' && value.trim() === '') &&
      !(Array.isArray(value) && value.length === 0);
    return {
      isValid,
      message: isValid ? null : `${field} is required`,
    };
  }

  Nullable(_field: string, _value: any) {
    return { isValid: true, message: null };
  }

  String(field: string, value: any) {
    const isValid = typeof value === 'string';
    return {
      isValid,
      message: isValid ? null : `${field} must be a string`,
    };
  }

  Numeric(field: string, value: any) {
    const isValid =
      typeof value === 'number' || (!isNaN(Number(value)) && value !== '');
    return {
      isValid,
      message: isValid ? null : `${field} must be a number`,
    };
  }

  Boolean(field: string, value: any) {
    const isValid = typeof value === 'boolean';
    return {
      isValid,
      message: isValid ? null : `${field} must be true or false`,
    };
  }

  Array(field: string, value: any) {
    const isValid = Array.isArray(value);
    return {
      isValid,
      message: isValid ? null : `${field} must be an array`,
    };
  }

  Min(field: string, limit: number, value: any) {
    let isValid = false;
    if (typeof value === 'string') isValid = value.length >= limit;
    else if (typeof value === 'number') isValid = value >= limit;
    else if (Array.isArray(value)) isValid = value.length >= limit;
    return {
      isValid,
      message: isValid
        ? null
        : `The ${field} must be at least ${limit}${typeof value === 'number' ? '' : ' characters'}`,
    };
  }

  Max(field: string, limit: number, value: any) {
    let isValid = false;
    if (typeof value === 'string') isValid = value.length <= limit;
    else if (typeof value === 'number') isValid = value <= limit;
    else if (Array.isArray(value)) isValid = value.length <= limit;
    return {
      isValid,
      message: isValid
        ? null
        : `The ${field} may not be greater than ${limit}${typeof value === 'number' ? '' : ' characters'}`,
    };
  }

  Exact(field: string, limit: number, value: any) {
    let isValid = false;
    if (typeof value === 'string') isValid = value.length === limit;
    else if (typeof value === 'number') isValid = value === limit;
    else if (Array.isArray(value)) isValid = value.length === limit;
    return {
      isValid,
      message: isValid
        ? null
        : `The ${field} must be exactly ${limit}${typeof value === 'number' ? '' : ' characters'}`,
    };
  }

  Email(field: string, data: string) {
    const isValid = /^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(data);
    return {
      isValid,
      message: isValid ? null : `The ${field} must be a valid email address`,
    };
  }

  Validate(field: string, rule: Rule, value: any, fields?: any) {
    if (typeof rule === 'string') {
      if (rule === 'required') return this.Required(field, value);
      if (rule === 'nullable') return this.Nullable(field, value);
      if (rule === 'string') return this.String(field, value);
      if (rule === 'numeric') return this.Numeric(field, value);
      if (rule === 'boolean') return this.Boolean(field, value);
      if (rule === 'array') return this.Array(field, value);
      if (rule === 'email') return this.Email(field, value);
      if (rule === 'date') return this.Date(field, value);
      if (rule.startsWith('date_equals:')) {
        const compare = rule.split(':')[1] ?? '';
        return this.DateEquals(field, compare, value);
      }
      if (rule.startsWith('date_format:')) {
        const format = rule.split(':')[1] ?? '';
        return this.DateFormat(field, format, value);
      }
      if (rule.startsWith('after:')) {
        const compare = rule.split(':')[1] ?? '';
        return this.After(field, compare, value);
      }
      if (rule.startsWith('after_or_equal:')) {
        const compare = rule.split(':')[1] ?? '';
        return this.AfterOrEqual(field, compare, value);
      }
      if (rule.startsWith('before:')) {
        const compare = rule.split(':')[1] ?? '';
        return this.Before(field, compare, value);
      }
      if (rule.startsWith('before_or_equal:')) {
        const compare = rule.split(':')[1] ?? '';
        return this.BeforeOrEqual(field, compare, value);
      }
      if (rule.startsWith('different:')) {
        const compareField = rule.split(':')[1] ?? '';
        return this.Different(field, compareField, value, fields);
      }
      if (rule.startsWith('timezone:')) {
        const tz = rule.split(':')[1] ?? '';
        return this.Timezone(field, tz, value);
      }
      if (rule.startsWith('min:')) {
        const limit = Number(rule.split(':')[1]);
        return this.Min(field, limit, value);
      }
      if (rule.startsWith('max:')) {
        const limit = Number(rule.split(':')[1]);
        return this.Max(field, limit, value);
      }
      if (rule.startsWith('exact:')) {
        const limit = Number(rule.split(':')[1]);
        return this.Exact(field, limit, value);
      }
      if (rule.startsWith('between:')) {
        const parts = (rule.split(':')[1] ?? '').split(',').map(Number);
        const min = parts[0] ?? 0;
        const max = parts[1] ?? 0;
        return this.Min(field, min, value).isValid &&
          this.Max(field, max, value).isValid
          ? { isValid: true, message: null }
          : {
              isValid: false,
              message: `The ${field} must be between ${min} and ${max}`,
            };
      }
      if (rule.startsWith('in:')) {
        const values = rule.substring(3).split(',');
        return this.In(field, values, value);
      }
      return { isValid: true, message: null };
    }
    return {
      isValid: true,
      message: null,
    };
  }
}

// Base validation rules without parameters
export type BaseRule =
  | 'required'
  | 'email'
  | 'numeric'
  | 'boolean'
  | 'nullable'
  | 'string'
  | 'array'
  | 'date';

// Rules that require parameters
export type ParameterizedRule =
  | `min:${number}`
  | `max:${number}`
  | `exact:${number}`
  | `in:${string}`
  | `between:${number},${number}`
  | 'date'
  | `date_equals:${string}`
  | `date_format:${string}`
  | `after:${string}`
  | `after_or_equal:${string}`
  | `before:${string}`
  | `before_or_equal:${string}`
  | `different:${string}`
  | `timezone:${string}`;

// Combined Rule type
export type Rule = BaseRule | ParameterizedRule;

export default ValidationUtils;
