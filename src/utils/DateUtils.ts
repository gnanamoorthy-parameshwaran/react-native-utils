/**
 * Shared building blocks for Carbon, CarbonInterval and CarbonPeriod: unit tables, calendar maths and
 * time zone offsets. Everything works on "wall time": an instant shifted by its zone offset and then
 * read through the UTC getters, so one set of date arithmetic serves every time zone.
 */

type Unit =
    | 'microsecond'
    | 'millisecond'
    | 'second'
    | 'minute'
    | 'hour'
    | 'day'
    | 'week'
    | 'month'
    | 'quarter'
    | 'year'
    | 'decade'
    | 'century'
    | 'millennium';

const ORDER = [
    'microsecond',
    'millisecond',
    'second',
    'minute',
    'hour',
    'day',
    'week',
    'month',
    'quarter',
    'year',
    'decade',
    'century',
    'millennium',
] as const;

/**
 * Method-name forms of every unit: `s` are singular forms, `p` plural forms. The generated
 * `addDays`, `isSameMonth`, `diffInHours` ... families and their types are both derived from this table.
 */
const UNIT_TABLE = {
    microsecond: {s: ['Microsecond', 'Micro'], p: ['Microseconds', 'Micros']},
    millisecond: {s: ['Millisecond', 'Milli'], p: ['Milliseconds', 'Millis']},
    second: {s: ['Second'], p: ['Seconds']},
    minute: {s: ['Minute'], p: ['Minutes']},
    hour: {s: ['Hour'], p: ['Hours']},
    day: {s: ['Day'], p: ['Days']},
    week: {s: ['Week'], p: ['Weeks']},
    month: {s: ['Month'], p: ['Months']},
    quarter: {s: ['Quarter'], p: ['Quarters']},
    year: {s: ['Year'], p: ['Years']},
    decade: {s: ['Decade'], p: ['Decades']},
    century: {s: ['Century'], p: ['Centuries']},
    millennium: {s: ['Millennium'], p: ['Millennia']},
} as const;

const PLURAL_NAME = {
    microsecond: 'microseconds',
    millisecond: 'milliseconds',
    second: 'seconds',
    minute: 'minutes',
    hour: 'hours',
    day: 'days',
    week: 'weeks',
    month: 'months',
    quarter: 'quarters',
    year: 'years',
    decade: 'decades',
    century: 'centuries',
    millennium: 'millennia',
} as const;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Elapsed length of the fixed-size units, in milliseconds. */
const FIXED_MS: Partial<Record<Unit, number>> = {
    microsecond: 0.001,
    millisecond: 1,
    second: SECOND,
    minute: MINUTE,
    hour: HOUR,
    day: DAY,
    week: WEEK,
};

/** Calendar units measured in months. */
const MONTHS_PER: Partial<Record<Unit, number>> = {month: 1, quarter: 3, year: 12, decade: 120, century: 1200, millennium: 12000};

const isCalendarUnit = (unit: Unit) => unit in MONTHS_PER;

const LOOKUP: Record<string, Unit> = {};

(Object.keys(UNIT_TABLE) as Unit[]).forEach(unit => {
    LOOKUP[unit] = unit;
    [...UNIT_TABLE[unit].s, ...UNIT_TABLE[unit].p].forEach(form => {
        LOOKUP[form.toLowerCase()] = unit;
    });
});

/** Accepts "day", "days", "Days", "millis", "centuries" ... and returns the canonical unit. */
const normalizeUnit = (name: string): Unit => {
    const unit = LOOKUP[name.toLowerCase()];

    if (!unit) {
        throw new Error(`Unknown unit "${name}".`);
    }

    return unit;
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);
const pad = (value: number, length = 2) => String(Math.abs(Math.trunc(value))).padStart(length, '0');

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const daysInMonth = ({year, month}: {year: number; month: number}) =>
    [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] as number;

type Parts = {year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number; weekday: number};

const partsFromWall = (wall: number): Parts => {
    const date = new Date(wall);

    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
        millisecond: date.getUTCMilliseconds(),
        weekday: date.getUTCDay(),
    };
};

/** Out-of-range fields roll over like `Date.UTC`, but years 0-99 are kept as written. */
const wallFromParts = ({year, month = 1, day = 1, hour = 0, minute = 0, second = 0, millisecond = 0}: Partial<Parts>) => {
    const date = new Date(0);
    date.setUTCFullYear(year ?? 1970, month - 1, day);
    date.setUTCHours(hour, minute, second, millisecond);
    return date.getTime();
};

const dayOfYear = ({year, month, day}: {year: number; month: number; day: number}) =>
    Math.round((wallFromParts({year, month, day}) - wallFromParts({year, month: 1, day: 1})) / DAY) + 1;

/** ISO-8601 week number and week-year of a calendar date. */
const isoWeek = ({year, month, day}: {year: number; month: number; day: number}) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCFullYear(year);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);
    const isoYear = date.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
    firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);

    return {week: 1 + Math.round((date.getTime() - firstThursday.getTime()) / WEEK), year: isoYear};
};

const isoWeeksInYear = (year: number) => isoWeek({year, month: 12, day: 28}).week;

type TimeZoneName = string | undefined;

const FIXED_OFFSET = /^(?:(?:utc|gmt)?\s*([+-])(\d{1,2})(?::?(\d{2}))?)$/i;

/** Seconds east of UTC for fixed names ("UTC", "+05:30"), `undefined` for region names. */
const fixedOffsetSeconds = (tz: string) => {
    if (/^(utc|gmt|z|etc\/utc|etc\/gmt)$/i.test(tz)) {
        return 0;
    }

    const match = tz.match(FIXED_OFFSET);
    return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 3600 + Number(match[3] ?? 0) * 60) : undefined;
};

const formatOffset = ({seconds, colon = true}: {seconds: number; colon?: boolean}) => {
    const sign = seconds < 0 ? '-' : '+';
    const total = Math.abs(Math.round(seconds / 60));

    return `${sign}${pad(Math.floor(total / 60))}${colon ? ':' : ''}${pad(total % 60)}`;
};

/** Turns an hour offset (5.5) or any zone name into the canonical string used internally. */
const normalizeTz = (tz: unknown): TimeZoneName => {
    if (tz === undefined || tz === null || tz === '') {
        return undefined;
    }

    if (typeof tz === 'number') {
        return formatOffset({seconds: tz * 3600});
    }

    const name = typeof tz === 'string' ? tz : String((tz as {toString(): string}).toString());
    const fixed = fixedOffsetSeconds(name);

    if (fixed !== undefined) {
        return /^[+-]/.test(name.trim()) ? formatOffset({seconds: fixed}) : 'UTC';
    }

    getFormatter(name);
    return name;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (tz: string) => {
    let formatter = formatterCache.get(tz);

    if (!formatter) {
        try {
            formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hourCycle: 'h23',
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
            });
        } catch {
            throw new Error(`Unknown or bad timezone (${tz})`);
        }

        formatterCache.set(tz, formatter);
    }

    return formatter;
};

/** Seconds east of UTC at the given instant. */
const offsetAt = ({ms, tz}: {ms: number; tz: TimeZoneName}): number => {
    if (tz === undefined) {
        return -new Date(ms).getTimezoneOffset() * 60;
    }

    const fixed = fixedOffsetSeconds(tz);

    if (fixed !== undefined) {
        return fixed;
    }

    const values: Record<string, number> = {};

    getFormatter(tz)
        .formatToParts(new Date(ms))
        .forEach(part => {
            if (part.type !== 'literal') {
                values[part.type] = Number(part.value);
            }
        });

    const wall = wallFromParts({
        year: values.year,
        month: values.month,
        day: values.day,
        hour: (values.hour ?? 0) % 24,
        minute: values.minute,
        second: values.second,
    });

    return Math.round((wall - Math.floor(ms / 1000) * 1000) / 1000);
};

const wallOf = ({ms, tz}: {ms: number; tz: TimeZoneName}) => ms + offsetAt({ms, tz}) * 1000;

/** Instant that shows `wall` on a clock in `tz`. Picks the earlier instant when a time repeats. */
const msFromWall = ({wall, tz}: {wall: number; tz: TimeZoneName}) => {
    if (tz !== undefined && fixedOffsetSeconds(tz) !== undefined) {
        return wall - (fixedOffsetSeconds(tz) as number) * 1000;
    }

    const first = wall - offsetAt({ms: wall, tz}) * 1000;
    const second = wall - offsetAt({ms: first, tz}) * 1000;

    return offsetAt({ms: second, tz}) === offsetAt({ms: first, tz}) ? second : first;
};

const tzDisplayName = (tz: TimeZoneName) => tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone;

const isDst = ({ms, tz}: {ms: number; tz: TimeZoneName}) => {
    const year = new Date(wallOf({ms, tz})).getUTCFullYear();
    const january = offsetAt({ms: Date.UTC(year, 0, 1), tz});
    const july = offsetAt({ms: Date.UTC(year, 6, 1), tz});

    return january !== july && offsetAt({ms, tz}) > Math.min(january, july);
};

const tzAbbreviation = ({ms, tz}: {ms: number; tz: TimeZoneName}) => {
    if (tz !== undefined) {
        const fixed = fixedOffsetSeconds(tz);

        if (fixed !== undefined) {
            return fixed === 0 && !/^[+-]/.test(tz) ? 'UTC' : formatOffset({seconds: fixed});
        }
    }

    const part = new Intl.DateTimeFormat('en-US', {...(tz ? {timeZone: tz} : {}), timeZoneName: 'short'})
        .formatToParts(new Date(ms))
        .find(item => item.type === 'timeZoneName');
    return part?.value ?? formatOffset({seconds: offsetAt({ms, tz})});
};

const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Weekday (0 = Sunday) and month (1-12) names for a locale; English names never touch `Intl`. */
const localeName = ({locale, kind, index, width}: {locale: string; kind: 'weekday' | 'month'; index: number; width: 'long' | 'short' | 'narrow'}) => {
    if (locale === 'en' || locale.startsWith('en-')) {
        const name = (kind === 'weekday' ? EN_DAYS : EN_MONTHS)[index - (kind === 'month' ? 1 : 0)] as string;
        return width === 'long' ? name : width === 'short' ? name.slice(0, 3) : name.slice(0, 1);
    }

    const date = kind === 'weekday' ? Date.UTC(2021, 0, 3 + index) : Date.UTC(2021, index - 1, 1);

    try {
        return new Intl.DateTimeFormat(locale, {timeZone: 'UTC', [kind]: width}).format(date);
    } catch {
        return localeName({locale: 'en', kind, index, width});
    }
};

const ordinalSuffix = (value: number) => {
    const lastTwo = Math.abs(value) % 100;
    return lastTwo >= 11 && lastTwo <= 13 ? 'th' : (({1: 'st', 2: 'nd', 3: 'rd'} as Record<number, string>)[lastTwo % 10] ?? 'th');
};

type Parsed = {ms: number; tz?: string};

const MONTHS: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    jun: 6,
    jul: 7,
    aug: 8,
    sept: 9,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
};

const WEEKDAYS: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sun: 0,
    mon: 1,
    tues: 2,
    tue: 2,
    wed: 3,
    thurs: 4,
    thur: 4,
    thu: 4,
    fri: 5,
    sat: 6,
};

type Relative = {months: number; days: number; ms: number; weekdays: number};

/** Maps the unit words of relative expressions ("2 weeks", "an hour") onto the relative totals. */
const addRelative = ({rel, word, value}: {rel: Relative; word: string; value: number}) => {
    const unit = word.replace(/s$/, '');

    switch (unit) {
        case 'ms':
        case 'msec':
        case 'millisecond':
            rel.ms += value;
            return true;
        case 'sec':
        case 'second':
            rel.ms += value * 1000;
            return true;
        case 'min':
        case 'minute':
            rel.ms += value * 60000;
            return true;
        case 'hour':
        case 'hr':
            rel.ms += value * 3600000;
            return true;
        case 'day':
            rel.days += value;
            return true;
        case 'week':
            rel.days += value * 7;
            return true;
        case 'fortnight':
            rel.days += value * 14;
            return true;
        case 'month':
            rel.months += value;
            return true;
        case 'year':
            rel.months += value * 12;
            return true;
        case 'weekday':
            rel.weekdays += value;
            return true;
        default:
            return false;
    }
};

const MONTH_NAMES = Object.keys(MONTHS)
    .sort((a, b) => b.length - a.length)
    .join('|');
const WEEKDAY_NAMES = Object.keys(WEEKDAYS)
    .sort((a, b) => b.length - a.length)
    .join('|');

const toMs = (fraction: string | undefined) => (fraction ? Math.floor(Number(`0.${fraction}`) * 1000) : 0);

const toOffsetName = (value: string) => {
    if (value === 'z' || value === 'utc' || value === 'gmt') {
        return 'UTC';
    }

    const digits = value.replace(':', '');
    return formatOffset({seconds: (digits.startsWith('-') ? -1 : 1) * (Number(digits.slice(1, 3)) * 3600 + Number(digits.slice(3, 5) || 0) * 60)});
};

/**
 * Reads the English date strings people actually write: ISO dates, `d/m/Y`, month names, times,
 * keywords (`tomorrow`, `noon`), relative offsets (`+2 weeks`, `3 days ago`), weekday jumps
 * (`next friday`) and `first/last day of next month`. Fields the text leaves out come from `baseMs`,
 * so the same reader powers both `Carbon.parse` and `modify`.
 */
const interpret = ({text, baseMs, tz}: {text: string; baseMs: number; tz: TimeZoneName}): Parsed => {
    let rest = text.trim().toLowerCase();
    const fields = partsFromWall(wallOf({ms: baseMs, tz}));
    const rel: Relative = {months: 0, days: 0, ms: 0, weekdays: 0};
    let timeSet = false;
    let offsetTz: string | undefined;
    let firstLast: 'first' | 'last' | undefined;
    let weekdayTarget: {dow: number; mode: 'this' | 'next' | 'last'} | undefined;

    const consume = (pattern: RegExp) => {
        const match = rest.match(pattern);

        if (match) {
            rest = rest.slice(match[0].length).replace(/^[\s,]+/, '');
        }

        return match;
    };

    const setDate = ({year, month, day}: {year: number; month: number; day: number}) => {
        Object.assign(fields, {year, month, day});

        if (!timeSet) {
            Object.assign(fields, {hour: 0, minute: 0, second: 0, millisecond: 0});
        }
    };

    const setTime = ({hour, minute, second = 0, millisecond = 0}: {hour: number; minute: number; second?: number; millisecond?: number}) => {
        Object.assign(fields, {hour, minute, second, millisecond});
        timeSet = true;
    };

    while (rest) {
        let match: RegExpMatchArray | null;

        if (
            (match = consume(
                /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t\s]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?(?:\s*(z|[+-]\d{2}:\d{2}|[+-]\d{4}|[+-]\d{2}(?=\s*$))(?![a-z0-9]))?/,
            ))
        ) {
            timeSet = false;
            setDate({year: Number(match[1]), month: Number(match[2]), day: Number(match[3])});

            if (match[4] !== undefined) {
                setTime({hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6] ?? 0), millisecond: toMs(match[7])});
            }

            if (match[8]) {
                offsetTz = toOffsetName(match[8]);
            }
        } else if ((match = consume(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/))) {
            setDate({year: Number(match[1]), month: Number(match[2]), day: Number(match[3])});
        } else if ((match = consume(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) {
            setDate({year: Number(match[3]), month: Number(match[1]), day: Number(match[2])});
        } else if ((match = consume(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})/))) {
            setDate({year: Number(match[3]), month: Number(match[2]), day: Number(match[1])});
        } else if ((match = consume(/^(\d{4})(\d{2})(\d{2})(?!\d)/))) {
            setDate({year: Number(match[1]), month: Number(match[2]), day: Number(match[3])});
        } else if ((match = consume(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(am|pm)?(?![a-z])/))) {
            const meridiem = match[5];
            const hour = (Number(match[1]) % (meridiem ? 12 : 24)) + (meridiem === 'pm' ? 12 : 0);
            setTime({hour, minute: Number(match[2]), second: Number(match[3] ?? 0), millisecond: toMs(match[4])});
        } else if ((match = consume(/^(\d{1,2})\s*(am|pm)(?![a-z])/))) {
            setTime({hour: (Number(match[1]) % 12) + (match[2] === 'pm' ? 12 : 0), minute: 0});
        } else if ((match = consume(/^(z|utc|gmt)(?![a-z])|^([+-]\d{2}:?\d{2})(?!\d)/))) {
            offsetTz = toOffsetName(match[1] ?? (match[2] as string));
        } else if (consume(/^now(?![a-z])/)) {
            continue;
        } else if (consume(/^(today|midnight)(?![a-z])/)) {
            setTime({hour: 0, minute: 0});
        } else if (consume(/^noon(?![a-z])/)) {
            setTime({hour: 12, minute: 0});
        } else if (consume(/^tomorrow(?![a-z])/)) {
            rel.days += 1;
            setTime({hour: 0, minute: 0});
        } else if (consume(/^yesterday(?![a-z])/)) {
            rel.days -= 1;
            setTime({hour: 0, minute: 0});
        } else if ((match = consume(/^(first|last) day of(?![a-z])/))) {
            firstLast = match[1] as 'first' | 'last';
        } else if ((match = consume(new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAMES})\\.?(?![a-z])(?:,?\\s*(\\d{4})(?![\\d:]))?`)))) {
            setDate({year: match[3] ? Number(match[3]) : fields.year, month: MONTHS[match[2] as string] as number, day: Number(match[1])});
        } else if ((match = consume(new RegExp(`^(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?![\\d:])(?:,?\\s*(\\d{4})(?![\\d:]))?`)))) {
            setDate({year: match[3] ? Number(match[3]) : fields.year, month: MONTHS[match[1] as string] as number, day: Number(match[2])});
        } else if ((match = consume(new RegExp(`^(${MONTH_NAMES})\\.?(?![a-z])(?:\\s+(\\d{4})(?![\\d:]))?`)))) {
            setDate({year: match[2] ? Number(match[2]) : fields.year, month: MONTHS[match[1] as string] as number, day: 1});
        } else if ((match = consume(/^(next|last|previous|this)\s+([a-z]+)/))) {
            const word = match[2] as string;
            const mode = match[1] === 'next' ? 'next' : match[1] === 'this' ? 'this' : 'last';

            if (word in WEEKDAYS) {
                weekdayTarget = {dow: WEEKDAYS[word] as number, mode};
            } else if (!addRelative({rel, word, value: mode === 'next' ? 1 : mode === 'last' ? -1 : 0})) {
                throw new Error(`Failed to parse time string (${text})`);
            }
        } else if (consume(/^ago(?![a-z])/)) {
            rel.months *= -1;
            rel.days *= -1;
            rel.ms *= -1;
            rel.weekdays *= -1;
        } else if (
            (match = consume(/^([+-]?)\s*(\d+|an?(?=\s))\s*([a-z]+)/)) &&
            addRelative({rel, word: match[3] as string, value: (match[1] === '-' ? -1 : 1) * (/^\d/.test(match[2] as string) ? Number(match[2]) : 1)})
        ) {
            continue;
        } else if ((match = consume(new RegExp(`^(${WEEKDAY_NAMES})(?![a-z])`)))) {
            weekdayTarget = {dow: WEEKDAYS[match[1] as string] as number, mode: 'this'};
        } else if (consume(/^(at|on|of|the|and)(?![a-z])/)) {
            continue;
        } else {
            throw new Error(`Failed to parse time string (${text})`);
        }
    }

    if (firstLast) {
        fields.day = 1;
    }

    let wall = wallFromParts(fields);

    if (rel.months) {
        const shifted = partsFromWall(wall);
        wall = wallFromParts({...shifted, month: shifted.month + rel.months});
    }

    if (firstLast === 'last') {
        const shifted = partsFromWall(wall);
        wall = wallFromParts({...shifted, day: daysInMonth({year: shifted.year, month: shifted.month})});
    }

    wall += rel.days * DAY;

    if (weekdayTarget) {
        const current = partsFromWall(wall).weekday;
        const {dow, mode} = weekdayTarget;
        const forward =
            mode === 'this' ? (dow - current + 7) % 7 : mode === 'next' ? ((dow - current + 6) % 7) + 1 : -(((current - dow + 6) % 7) + 1);
        wall += forward * DAY;

        if (!timeSet) {
            wall = Math.floor(wall / DAY) * DAY;
        }
    }

    for (let remaining = Math.abs(rel.weekdays), step = rel.weekdays < 0 ? -1 : 1; remaining > 0;) {
        wall += step * DAY;
        const weekday = partsFromWall(wall).weekday;

        if (weekday !== 0 && weekday !== 6) {
            remaining--;
        }
    }

    const zone = offsetTz ?? tz;
    const result: Parsed = {ms: msFromWall({wall, tz: zone}) + rel.ms};

    if (offsetTz) {
        result.tz = offsetTz;
    }

    return result;
};

type FormatInput = {ms: number; tz: TimeZoneName; format: string; locale?: string};

const dayName = ({locale, weekday, width}: {locale?: string; weekday: number; width: 'long' | 'short' | 'narrow'}) =>
    localeName({locale: locale ?? 'en', kind: 'weekday', index: weekday, width});
const monthName = ({locale, month, width}: {locale?: string; month: number; width: 'long' | 'short' | 'narrow'}) =>
    localeName({locale: locale ?? 'en', kind: 'month', index: month, width});

/** PHP `date()` format characters. Names are English unless a `locale` is given (translatedFormat). */
const phpFormat = ({ms, tz, format, locale}: FormatInput): string => {
    const wall = wallOf({ms, tz});
    const p = partsFromWall(wall);
    const offset = offsetAt({ms, tz});
    const iso = isoWeek(p);
    const hour12 = p.hour % 12 || 12;

    const token = (char: string): string | undefined => {
        switch (char) {
            case 'd':
                return pad(p.day);
            case 'D':
                return dayName({locale, weekday: p.weekday, width: 'short'});
            case 'j':
                return String(p.day);
            case 'l':
                return dayName({locale, weekday: p.weekday, width: 'long'});
            case 'N':
                return String(p.weekday || 7);
            case 'S':
                return ordinalSuffix(p.day);
            case 'w':
                return String(p.weekday);
            case 'z':
                return String(dayOfYear(p) - 1);
            case 'W':
                return pad(iso.week);
            case 'F':
                return monthName({locale, month: p.month, width: 'long'});
            case 'm':
                return pad(p.month);
            case 'M':
                return monthName({locale, month: p.month, width: 'short'});
            case 'n':
                return String(p.month);
            case 't':
                return String(daysInMonth(p));
            case 'L':
                return isLeapYear(p.year) ? '1' : '0';
            case 'o':
                return String(iso.year);
            case 'Y':
                return String(p.year);
            case 'y':
                return pad(p.year % 100);
            case 'a':
                return p.hour < 12 ? 'am' : 'pm';
            case 'A':
                return p.hour < 12 ? 'AM' : 'PM';
            case 'B':
                return pad(Math.floor(((((ms + HOUR) % DAY) + DAY) % DAY) / 86400), 3);
            case 'g':
                return String(hour12);
            case 'G':
                return String(p.hour);
            case 'h':
                return pad(hour12);
            case 'H':
                return pad(p.hour);
            case 'i':
                return pad(p.minute);
            case 's':
                return pad(p.second);
            case 'u':
                return pad(p.millisecond * 1000, 6);
            case 'v':
                return pad(p.millisecond, 3);
            case 'e':
                return tzDisplayName(tz);
            case 'I':
                return isDst({ms, tz}) ? '1' : '0';
            case 'O':
                return formatOffset({seconds: offset, colon: false});
            case 'P':
                return formatOffset({seconds: offset});
            case 'p':
                return offset === 0 ? 'Z' : formatOffset({seconds: offset});
            case 'T':
                return tzAbbreviation({ms, tz});
            case 'Z':
                return String(offset);
            case 'c':
                return phpFormat({ms, tz, format: 'Y-m-d\\TH:i:sP', locale});
            case 'r':
                return phpFormat({ms, tz, format: 'D, d M Y H:i:s O', locale});
            case 'U':
                return String(Math.floor(ms / 1000));
            default:
                return undefined;
        }
    };

    let output = '';

    for (let i = 0; i < format.length; i++) {
        const char = format.charAt(i);

        if (char === '\\') {
            output += format.charAt(++i);
        } else {
            output += token(char) ?? char;
        }
    }

    return output;
};

const ISO_LONG_FORMATS: Record<string, string> = {
    LTS: 'h:mm:ss A',
    LT: 'h:mm A',
    LLLL: 'dddd, MMMM D, YYYY h:mm A',
    LLL: 'MMMM D, YYYY h:mm A',
    LL: 'MMMM D, YYYY',
    L: 'MM/DD/YYYY',
    llll: 'ddd, MMM D, YYYY h:mm A',
    lll: 'MMM D, YYYY h:mm A',
    ll: 'MMM D, YYYY',
    l: 'M/D/YYYY',
};

const ISO_TOKENS =
    /\[([^\]]*)\]|YYYYYY|YYYY|YY|Y|Qo|Q|MMMM|MMM|MM|Mo|M|DDDD|DDD|DD|Do|D|dddd|ddd|dd|do|d|E|e|WW|Wo|W|ww|wo|w|GGGG|gggg|HH|H|hh|h|kk|k|mm|m|ss|s|S{1,9}|zz|z|ZZ|Z|A|a|X|x/g;

/** Moment-style tokens (YYYY, MMM, Do, HH:mm ...). `[text]` is copied as written. */
const isoFormat = ({ms, tz, format, locale}: FormatInput): string => {
    const wall = wallOf({ms, tz});
    const p = partsFromWall(wall);
    const offset = offsetAt({ms, tz});
    const iso = isoWeek(p);
    const hour12 = p.hour % 12 || 12;
    const expanded = format.replace(/\[[^\]]*\]|LTS|LT|LLLL|LLL|LL|L|llll|lll|ll|l/g, match =>
        match.startsWith('[') ? match : (ISO_LONG_FORMATS[match] ?? match),
    );

    return expanded.replace(ISO_TOKENS, (match, escaped?: string) => {
        if (escaped !== undefined) {
            return escaped;
        }

        if (match.startsWith('S')) {
            return pad(p.millisecond, 3).padEnd(match.length, '0').slice(0, match.length);
        }

        switch (match) {
            case 'YYYYYY':
                return (p.year < 0 ? '-' : '+') + pad(p.year, 6);
            case 'YYYY':
                return pad(p.year, 4);
            case 'YY':
                return pad(p.year % 100);
            case 'Y':
                return String(p.year);
            case 'Q':
                return String(Math.ceil(p.month / 3));
            case 'Qo':
                return `${Math.ceil(p.month / 3)}${ordinalSuffix(Math.ceil(p.month / 3))}`;
            case 'MMMM':
                return monthName({locale, month: p.month, width: 'long'});
            case 'MMM':
                return monthName({locale, month: p.month, width: 'short'});
            case 'MM':
                return pad(p.month);
            case 'Mo':
                return `${p.month}${ordinalSuffix(p.month)}`;
            case 'M':
                return String(p.month);
            case 'DDDD':
                return pad(dayOfYear(p), 3);
            case 'DDD':
                return String(dayOfYear(p));
            case 'DD':
                return pad(p.day);
            case 'Do':
                return `${p.day}${ordinalSuffix(p.day)}`;
            case 'D':
                return String(p.day);
            case 'dddd':
                return dayName({locale, weekday: p.weekday, width: 'long'});
            case 'ddd':
                return dayName({locale, weekday: p.weekday, width: 'short'});
            case 'dd':
                return dayName({locale, weekday: p.weekday, width: 'short'}).slice(0, 2);
            case 'do':
                return `${p.weekday}${ordinalSuffix(p.weekday)}`;
            case 'd':
            case 'e':
                return String(p.weekday);
            case 'E':
                return String(p.weekday || 7);
            case 'WW':
            case 'ww':
                return pad(iso.week);
            case 'Wo':
            case 'wo':
                return `${iso.week}${ordinalSuffix(iso.week)}`;
            case 'W':
            case 'w':
                return String(iso.week);
            case 'GGGG':
            case 'gggg':
                return String(iso.year);
            case 'HH':
                return pad(p.hour);
            case 'H':
                return String(p.hour);
            case 'hh':
                return pad(hour12);
            case 'h':
                return String(hour12);
            case 'kk':
                return pad(p.hour || 24);
            case 'k':
                return String(p.hour || 24);
            case 'mm':
                return pad(p.minute);
            case 'm':
                return String(p.minute);
            case 'ss':
                return pad(p.second);
            case 's':
                return String(p.second);
            case 'zz':
            case 'z':
                return tzAbbreviation({ms, tz});
            case 'ZZ':
                return formatOffset({seconds: offset, colon: false});
            case 'Z':
                return formatOffset({seconds: offset});
            case 'A':
                return p.hour < 12 ? 'AM' : 'PM';
            case 'a':
                return p.hour < 12 ? 'am' : 'pm';
            case 'X':
                return String(Math.floor(ms / 1000));
            case 'x':
                return String(ms);
            default:
                return match;
        }
    });
};

type ParseState = {
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
    minute?: number;
    second?: number;
    millisecond?: number;
    pm?: boolean;
    dayOfYear?: number;
    tz?: string;
    timestamp?: number;
    timestampMs?: number;
};

type Spec = {pattern: string; apply?: (state: ParseState, value: string) => void; time?: boolean};

const monthFromName = (value: string) => {
    const lower = value.toLowerCase();
    const index = EN_MONTHS.findIndex(name => name.toLowerCase() === lower || name.toLowerCase().slice(0, 3) === lower.slice(0, 3));
    return index + 1;
};

const fraction = (value: string) => Math.floor(Number(`0.${value}`) * 1000);
const twoDigitYear = (value: number) => (value >= 70 ? 1900 + value : 2000 + value);
const OFFSET_PATTERN = '(?:z|utc|gmt|[+-]\\d{2}:?\\d{2})';
const toOffset = (value: string) => {
    const lower = value.toLowerCase();

    if (lower === 'z' || lower === 'utc' || lower === 'gmt') {
        return 'UTC';
    }

    const digits = value.replace(':', '');
    return formatOffset({seconds: (digits.startsWith('-') ? -1 : 1) * (Number(digits.slice(1, 3)) * 3600 + Number(digits.slice(3, 5)) * 60)});
};

const PHP_SPECS: Record<string, Spec> = {
    d: {pattern: '(\\d{2})', apply: (s, v) => (s.day = Number(v))},
    j: {pattern: '(\\d{1,2})', apply: (s, v) => (s.day = Number(v))},
    D: {pattern: '([A-Za-z]{3})'},
    l: {pattern: '([A-Za-z]+)'},
    S: {pattern: '(st|nd|rd|th)'},
    z: {pattern: '(\\d{1,3})', apply: (s, v) => (s.dayOfYear = Number(v))},
    F: {pattern: '([A-Za-z]+)', apply: (s, v) => (s.month = monthFromName(v))},
    M: {pattern: '([A-Za-z]{3})', apply: (s, v) => (s.month = monthFromName(v))},
    m: {pattern: '(\\d{2})', apply: (s, v) => (s.month = Number(v))},
    n: {pattern: '(\\d{1,2})', apply: (s, v) => (s.month = Number(v))},
    Y: {pattern: '(-?\\d{4})', apply: (s, v) => (s.year = Number(v))},
    y: {pattern: '(\\d{2})', apply: (s, v) => (s.year = twoDigitYear(Number(v)))},
    a: {pattern: '(am|pm)', apply: (s, v) => (s.pm = v.toLowerCase() === 'pm')},
    A: {pattern: '(am|pm)', apply: (s, v) => (s.pm = v.toLowerCase() === 'pm')},
    g: {pattern: '(\\d{1,2})', apply: (s, v) => (s.hour = Number(v)), time: true},
    h: {pattern: '(\\d{2})', apply: (s, v) => (s.hour = Number(v)), time: true},
    G: {pattern: '(\\d{1,2})', apply: (s, v) => (s.hour = Number(v)), time: true},
    H: {pattern: '(\\d{2})', apply: (s, v) => (s.hour = Number(v)), time: true},
    i: {pattern: '(\\d{2})', apply: (s, v) => (s.minute = Number(v)), time: true},
    s: {pattern: '(\\d{2})', apply: (s, v) => (s.second = Number(v)), time: true},
    u: {pattern: '(\\d{1,6})', apply: (s, v) => (s.millisecond = fraction(v)), time: true},
    v: {pattern: '(\\d{1,3})', apply: (s, v) => (s.millisecond = Number(v)), time: true},
    e: {pattern: '([A-Za-z_/]+(?:[+-]\\d+)?|[+-]\\d{2}:?\\d{2})', apply: (s, v) => (s.tz = normalizeTz(v))},
    T: {pattern: '([A-Za-z]{1,5}|[+-]\\d{2}:?\\d{2})', apply: (s, v) => (s.tz = normalizeTz(v))},
    O: {pattern: `(${OFFSET_PATTERN})`, apply: (s, v) => (s.tz = toOffset(v))},
    P: {pattern: `(${OFFSET_PATTERN})`, apply: (s, v) => (s.tz = toOffset(v))},
    p: {pattern: `(${OFFSET_PATTERN})`, apply: (s, v) => (s.tz = toOffset(v))},
    U: {pattern: '(-?\\d+)', apply: (s, v) => (s.timestamp = Number(v))},
};

const ISO_SPECS: Record<string, Spec> = {
    YYYY: {pattern: '(\\d{4})', apply: (s, v) => (s.year = Number(v))},
    YY: {pattern: '(\\d{2})', apply: (s, v) => (s.year = twoDigitYear(Number(v)))},
    MMMM: {pattern: '([A-Za-z]+)', apply: (s, v) => (s.month = monthFromName(v))},
    MMM: {pattern: '([A-Za-z]{3})', apply: (s, v) => (s.month = monthFromName(v))},
    MM: {pattern: '(\\d{2})', apply: (s, v) => (s.month = Number(v))},
    M: {pattern: '(\\d{1,2})', apply: (s, v) => (s.month = Number(v))},
    DD: {pattern: '(\\d{2})', apply: (s, v) => (s.day = Number(v))},
    Do: {pattern: '(\\d{1,2})(?:st|nd|rd|th)', apply: (s, v) => (s.day = Number(v))},
    D: {pattern: '(\\d{1,2})', apply: (s, v) => (s.day = Number(v))},
    dddd: {pattern: '([A-Za-z]+)'},
    ddd: {pattern: '([A-Za-z]{3})'},
    HH: {pattern: '(\\d{2})', apply: (s, v) => (s.hour = Number(v)), time: true},
    H: {pattern: '(\\d{1,2})', apply: (s, v) => (s.hour = Number(v)), time: true},
    hh: {pattern: '(\\d{2})', apply: (s, v) => (s.hour = Number(v)), time: true},
    h: {pattern: '(\\d{1,2})', apply: (s, v) => (s.hour = Number(v)), time: true},
    mm: {pattern: '(\\d{2})', apply: (s, v) => (s.minute = Number(v)), time: true},
    m: {pattern: '(\\d{1,2})', apply: (s, v) => (s.minute = Number(v)), time: true},
    ss: {pattern: '(\\d{2})', apply: (s, v) => (s.second = Number(v)), time: true},
    s: {pattern: '(\\d{1,2})', apply: (s, v) => (s.second = Number(v)), time: true},
    SSS: {pattern: '(\\d{3})', apply: (s, v) => (s.millisecond = Number(v)), time: true},
    A: {pattern: '(am|pm)', apply: (s, v) => (s.pm = v.toLowerCase() === 'pm')},
    a: {pattern: '(am|pm)', apply: (s, v) => (s.pm = v.toLowerCase() === 'pm')},
    ZZ: {pattern: `(${OFFSET_PATTERN})`, apply: (s, v) => (s.tz = toOffset(v))},
    Z: {pattern: `(${OFFSET_PATTERN})`, apply: (s, v) => (s.tz = toOffset(v))},
    X: {pattern: '(-?\\d+)', apply: (s, v) => (s.timestamp = Number(v))},
    x: {pattern: '(-?\\d+)', apply: (s, v) => (s.timestampMs = Number(v))},
};

const ISO_PARSE_TOKENS = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|DD|Do|D|dddd|ddd|HH|H|hh|h|mm|m|ss|s|SSS|A|a|ZZ|Z|X|x/g;

type Compiled = {regex: RegExp; applies: {spec: Spec}[]; reset: boolean};

const compilePhpFormat = (format: string): Compiled => {
    let source = '';
    const applies: {spec: Spec}[] = [];
    let reset = false;

    for (let i = 0; i < format.length; i++) {
        const char = format.charAt(i);
        const spec = PHP_SPECS[char];

        if (spec) {
            source += spec.pattern;
            applies.push({spec});
        } else if (char === '!' || char === '|') {
            reset = true;
        } else if (char === '+') {
            source += '.*';
        } else if (char === '?') {
            source += '.';
        } else if (char === '*') {
            source += '[^\\s,;:/.\\-()]*';
        } else if (char === '\\') {
            source += escapeRegExp(format.charAt(++i));
        } else {
            source += escapeRegExp(char);
        }
    }

    return {regex: new RegExp(`^${source}$`, 'i'), applies, reset};
};

const compileIsoFormat = (format: string): Compiled => {
    let source = '';
    let last = 0;
    const applies: {spec: Spec}[] = [];

    format.replace(ISO_PARSE_TOKENS, (match: string, escaped: string | undefined, offset: number) => {
        source += escapeRegExp(format.slice(last, offset));
        last = offset + match.length;

        if (escaped !== undefined) {
            source += escapeRegExp(escaped);
            return match;
        }

        const spec = ISO_SPECS[match] as Spec;
        source += spec.pattern;
        applies.push({spec});
        return match;
    });

    return {regex: new RegExp(`^${source}${escapeRegExp(format.slice(last))}$`, 'i'), applies, reset: false};
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Fills the fields the text did not mention from "now" (or the epoch with `!` / `|`) and builds the instant. */
const finishParse = ({
    state,
    tz,
    nowMs,
    reset,
    timeParsed,
}: {
    state: ParseState;
    tz: TimeZoneName;
    nowMs: number;
    reset: boolean;
    timeParsed: boolean;
}): Parsed => {
    if (state.timestamp !== undefined || state.timestampMs !== undefined) {
        return {ms: state.timestampMs ?? (state.timestamp as number) * 1000, tz: '+00:00'};
    }

    const zone = state.tz ?? tz;
    const now = partsFromWall(wallOf({ms: nowMs, tz: zone}));
    const base = reset ? {year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0} : now;
    const zeroTime = timeParsed || reset;
    let hour = state.hour ?? (zeroTime ? 0 : base.hour);

    if (state.pm !== undefined) {
        hour = (hour % 12) + (state.pm ? 12 : 0);
    }

    const date =
        state.dayOfYear !== undefined
            ? {year: state.year ?? base.year, month: 1, day: state.dayOfYear + 1}
            : {year: state.year ?? base.year, month: state.month ?? base.month, day: state.day ?? base.day};

    const wall = wallFromParts({
        ...date,
        hour,
        minute: state.minute ?? (zeroTime ? 0 : base.minute),
        second: state.second ?? (zeroTime ? 0 : base.second),
        millisecond: state.millisecond ?? (zeroTime ? 0 : base.millisecond),
    });

    const result: Parsed = {ms: msFromWall({wall, tz: zone})};

    if (state.tz) {
        result.tz = state.tz;
    }

    return result;
};

const runCompiled = ({compiled, text, tz, nowMs}: {compiled: Compiled; text: string; tz: TimeZoneName; nowMs: number}): Parsed | null => {
    const match = text.trim().match(compiled.regex);

    if (!match) {
        return null;
    }

    const state: ParseState = {};
    let timeParsed = false;

    compiled.applies.forEach(({spec}, index) => {
        spec.apply?.(state, match[index + 1] as string);
        timeParsed = timeParsed || Boolean(spec.time);
    });

    return finishParse({state, tz, nowMs, reset: compiled.reset, timeParsed});
};

const parsePhpFormat = ({format, text, tz, nowMs}: {format: string; text: string; tz: TimeZoneName; nowMs: number}) =>
    runCompiled({compiled: compilePhpFormat(format), text, tz, nowMs});

const parseIsoFormat = ({format, text, tz, nowMs}: {format: string; text: string; tz: TimeZoneName; nowMs: number}) =>
    runCompiled({compiled: compileIsoFormat(format), text, tz, nowMs});

const matchesPhpFormat = ({format, text}: {format: string; text: string}) => compilePhpFormat(format).regex.test(text.trim());

type DateInput = Carbon | Date | string | number | null | undefined;
type TzInput = string | number | CarbonTimeZone | null | undefined;
type Weekday = number | string;
type HumanSyntax = 'auto' | 'absolute' | 'relativeToNow' | 'relativeToOther';
type HumanOption = 'oneDayWords' | 'twoDayWords' | 'justNow' | 'noZeroDiff' | 'seriesOfParts';

type HumanOptions = {
    other?: DateInput;
    syntax?: HumanSyntax;
    short?: boolean;
    parts?: number;
    join?: boolean | string | [string, string];
    options?: HumanOption[];
    locale?: string;
};

type CreateParts = {year?: number; month?: number; day?: number; hour?: number; minute?: number; second?: number; millisecond?: number; tz?: TzInput};

const isOptions = (value: unknown) => typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

/** Accepts either an options object or the single main value, so `diffInDays(date)` and `diffInDays({other: date})` both work. */
const asOptions = <O>({arg, key}: {arg: unknown; key: string}): O => (isOptions(arg) ? arg : {[key]: arg}) as O;

const settings = {
    testNow: undefined as Carbon | undefined,
    weekStartsAt: 1,
    weekendDays: [6, 0] as number[],
    locale: 'en',
    fallbackLocale: 'en',
    monthsOverflow: true,
    yearsOverflow: true,
    strict: true,
    toStringFormat: undefined as string | undefined,
    maxIteration: 1000,
    midDayAt: 12,
    holidays: [] as string[],
    businessDayChecker: undefined as ((date: Carbon) => boolean) | undefined,
    humanDiffOptions: new Set<HumanOption>(),
    macros: new Set<string>(),
    serializer: undefined as ((date: Carbon) => unknown) | undefined,
};

const nowMs = () => (settings.testNow ? settings.testNow.valueOf() : Date.now());

const WEEKDAY_INDEX: Record<string, number> = {sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6};

const weekdayNumber = (day: Weekday) => {
    if (typeof day === 'number') {
        return ((day % 7) + 7) % 7;
    }

    const found =
        WEEKDAY_INDEX[day.toLowerCase()] ?? Object.entries(WEEKDAY_INDEX).find(([name]) => name.startsWith(day.toLowerCase().slice(0, 3)))?.[1];

    if (found === undefined) {
        throw new Error(`Unknown day of week "${day}".`);
    }

    return found;
};

const build = ({ms, tz, locale}: {ms: number; tz: TimeZoneName; locale?: string}): Carbon => {
    const date = Object.create(Carbon.prototype) as any;
    date._ms = ms;
    date._tz = tz;
    date._locale = locale;
    return date as Carbon;
};

const toCarbon = (input: DateInput, tz?: TimeZoneName): Carbon => {
    if (input instanceof Carbon) {
        return tz === undefined ? input : input.setTimezone(tz);
    }

    return new Carbon({time: input, tz});
};

/** Unit boundaries on the wall clock: the start of the unit containing `wall`, and where the next one begins. */
const startWall = ({wall, unit, weekStart}: {wall: number; unit: Unit | 'season'; weekStart: number}): number => {
    const p = partsFromWall(wall);
    const year = (month: number, y = p.year) => wallFromParts({year: y, month});

    switch (unit) {
        case 'microsecond':
        case 'millisecond':
            return wall;
        case 'second':
            return Math.floor(wall / SECOND) * SECOND;
        case 'minute':
            return Math.floor(wall / MINUTE) * MINUTE;
        case 'hour':
            return Math.floor(wall / HOUR) * HOUR;
        case 'day':
            return Math.floor(wall / DAY) * DAY;
        case 'week':
            return Math.floor(wall / DAY) * DAY - ((p.weekday - weekStart + 7) % 7) * DAY;
        case 'month':
            return year(p.month);
        case 'quarter':
            return year(Math.floor((p.month - 1) / 3) * 3 + 1);
        case 'year':
            return year(1);
        case 'decade':
            return year(1, p.year - (((p.year % 10) + 10) % 10));
        case 'century':
            return year(1, Math.floor((p.year - 1) / 100) * 100 + 1);
        case 'millennium':
            return year(1, Math.floor((p.year - 1) / 1000) * 1000 + 1);
        case 'season': {
            const start = p.month >= 3 && p.month <= 5 ? 3 : p.month >= 6 && p.month <= 8 ? 6 : p.month >= 9 && p.month <= 11 ? 9 : 12;
            return year(start, start === 12 && p.month <= 2 ? p.year - 1 : p.year);
        }
    }
};

const nextWall = ({start, unit}: {start: number; unit: Unit | 'season'}): number => {
    const p = partsFromWall(start);
    const months = (count: number) => wallFromParts({year: p.year, month: p.month + count});

    switch (unit) {
        case 'microsecond':
        case 'millisecond':
            return start + 1;
        case 'second':
            return start + SECOND;
        case 'minute':
            return start + MINUTE;
        case 'hour':
            return start + HOUR;
        case 'day':
            return start + DAY;
        case 'week':
            return start + WEEK;
        case 'season':
        case 'quarter':
            return months(3);
        case 'month':
            return months(1);
        case 'year':
            return months(12);
        case 'decade':
            return months(120);
        case 'century':
            return months(1200);
        case 'millennium':
            return months(12000);
    }
};

const SHORT_UNITS: Record<string, string> = {year: 'yr', month: 'mo', week: 'w', day: 'd', hour: 'h', minute: 'min', second: 's'};

/** Immutable date-time with Carbon's API: every method that "changes" the date returns a new instance. */
class Carbon {
    private readonly _ms!: number;
    private readonly _tz!: TimeZoneName;
    private readonly _locale?: string;

    /**
     * `time` is a date string (ISO, `2024-03-05 10:00`, `next friday`, `+2 weeks` ...), a `Date`,
     * another Carbon, or a number of **milliseconds**. Pass `{time, tz}` to choose the zone.
     */
    constructor(time?: DateInput | {time?: DateInput; tz?: TzInput}) {
        const given = asOptions<{time?: DateInput; tz?: TzInput}>({arg: time, key: 'time'});
        const input = given.time;
        const zone = given.tz;
        let tz = normalizeTz(zone instanceof CarbonTimeZone ? zone.getName() : zone);

        if (input instanceof Carbon) {
            this._ms = input._ms;
            this._tz = zone === undefined || zone === null ? input._tz : tz;
        } else if (input instanceof Date) {
            this._ms = input.getTime();
            this._tz = tz;
        } else if (typeof input === 'number') {
            this._ms = input;
            this._tz = tz;
        } else if (typeof input === 'string' && input.trim() !== '') {
            const parsed = interpret({text: input, baseMs: nowMs(), tz});
            tz = parsed.tz ?? tz;
            this._ms = parsed.ms;
            this._tz = tz;
        } else {
            const test = settings.testNow;
            this._ms = nowMs();
            this._tz = zone === undefined || zone === null ? test?._tz : tz;
        }

        if (Number.isNaN(this._ms)) {
            throw new Error('Invalid date.');
        }
    }

    // ----------------------------------------------------------------- creation

    static now(tz?: TzInput): Carbon {
        return new Carbon({tz});
    }

    static today(tz?: TzInput): Carbon {
        return Carbon.now(tz).startOfDay();
    }

    static tomorrow(tz?: TzInput): Carbon {
        return Carbon.today(tz).addDay();
    }

    static yesterday(tz?: TzInput): Carbon {
        return Carbon.today(tz).subDay();
    }

    static parse(time?: DateInput | {time?: DateInput; tz?: TzInput}): Carbon {
        return new Carbon(time);
    }

    static make(time?: DateInput | {time?: DateInput; tz?: TzInput}): Carbon | null {
        try {
            return new Carbon(time);
        } catch {
            return null;
        }
    }

    static instance(date: DateInput): Carbon {
        return toCarbon(date);
    }

    static createFromInterface(date: DateInput): Carbon {
        return toCarbon(date);
    }

    static createFromImmutable(date: DateInput): Carbon {
        return toCarbon(date);
    }

    static carbonize(date: DateInput): Carbon {
        return toCarbon(date);
    }

    static cast(date: DateInput): Carbon {
        return toCarbon(date);
    }

    static isDateTimeInstance(value: unknown): boolean {
        return value instanceof Carbon || value instanceof Date;
    }

    /** Missing fields default to now (or 0 for the time when a date is given), like `Carbon::create`. */
    static create({year, month, day, hour, minute, second, millisecond, tz}: CreateParts = {}): Carbon {
        const zone = normalizeTz(tz instanceof CarbonTimeZone ? tz.getName() : tz);
        const now = Carbon.now(zone);
        const given = year !== undefined || month !== undefined || day !== undefined;
        const p = now.parts();
        const timeGiven = hour !== undefined || minute !== undefined || second !== undefined || millisecond !== undefined;

        const wall = wallFromParts({
            year: year ?? p.year,
            month: month ?? (year !== undefined ? 1 : p.month),
            day: day ?? (given && (year !== undefined || month !== undefined) ? 1 : p.day),
            hour: hour ?? (given || timeGiven ? 0 : p.hour),
            minute: minute ?? (given || timeGiven ? 0 : p.minute),
            second: second ?? (given || timeGiven ? 0 : p.second),
            millisecond: millisecond ?? (given || timeGiven ? 0 : p.millisecond),
        });

        return build({ms: msFromWall({wall, tz: zone}), tz: zone});
    }

    static createFromDate({year, month, day, tz}: {year?: number; month?: number; day?: number; tz?: TzInput} = {}): Carbon {
        const now = Carbon.now(tz);
        const p = now.parts();

        return Carbon.create({
            year: year ?? p.year,
            month: month ?? p.month,
            day: day ?? p.day,
            hour: p.hour,
            minute: p.minute,
            second: p.second,
            millisecond: p.millisecond,
            tz,
        });
    }

    static createFromTime({
        hour = 0,
        minute = 0,
        second = 0,
        millisecond = 0,
        tz,
    }: {hour?: number; minute?: number; second?: number; millisecond?: number; tz?: TzInput} = {}): Carbon {
        const p = Carbon.now(tz).parts();
        return Carbon.create({year: p.year, month: p.month, day: p.day, hour, minute, second, millisecond, tz});
    }

    static createFromTimeString(time: string | {time: string; tz?: TzInput}): Carbon {
        const {text, tz} = typeof time === 'string' ? {text: time, tz: undefined} : {text: time.time, tz: time.tz};
        const today = Carbon.today(tz);
        return new Carbon({time: `${today.format('Y-m-d')} ${text}`, tz});
    }

    static createMidnightDate({year, month, day, tz}: {year?: number; month?: number; day?: number; tz?: TzInput} = {}): Carbon {
        return Carbon.createFromDate({year, month, day, tz}).startOfDay();
    }

    /** Throws instead of rolling over when a field is out of range (Feb 30, hour 25 ...). */
    static createSafe(parts: CreateParts = {}): Carbon {
        const date = Carbon.create(parts);
        const checks: [string, number | undefined, number][] = [
            ['year', parts.year, date.year()],
            ['month', parts.month, date.month()],
            ['day', parts.day, date.day()],
            ['hour', parts.hour, date.hour()],
            ['minute', parts.minute, date.minute()],
            ['second', parts.second, date.second()],
        ];

        checks.forEach(([name, given, actual]) => {
            if (given !== undefined && given !== actual) {
                throw new Error(`${name} must be a valid value (${given} is out of range).`);
            }
        });

        return date;
    }

    static createStrict(parts: CreateParts = {}): Carbon {
        return Carbon.createSafe(parts);
    }

    static createFromTimestamp(timestamp: number | {timestamp: number; tz?: TzInput}): Carbon {
        const {value, tz} = typeof timestamp === 'number' ? {value: timestamp, tz: undefined} : {value: timestamp.timestamp, tz: timestamp.tz};
        return new Carbon({time: Math.round(value * 1000), tz});
    }

    static createFromTimestampMs(timestamp: number | {timestamp: number; tz?: TzInput}): Carbon {
        const {value, tz} = typeof timestamp === 'number' ? {value: timestamp, tz: undefined} : {value: timestamp.timestamp, tz: timestamp.tz};
        return new Carbon({time: Math.round(value), tz});
    }

    static createFromTimestampUTC(timestamp: number): Carbon {
        return Carbon.createFromTimestamp({timestamp, tz: 'UTC'});
    }

    static createFromTimestampMsUTC(timestamp: number): Carbon {
        return Carbon.createFromTimestampMs({timestamp, tz: 'UTC'});
    }

    static unix(timestamp: number): Carbon {
        return Carbon.createFromTimestamp(timestamp);
    }

    /** Parse with PHP `date()` format characters; throws when the text does not match. */
    static createFromFormat({format, time, tz}: {format: string; time: string; tz?: TzInput}): Carbon {
        const zone = normalizeTz(tz instanceof CarbonTimeZone ? tz.getName() : tz);
        const parsed = parsePhpFormat({format, text: time, tz: zone, nowMs: nowMs()});

        if (!parsed) {
            throw new Error(`Trailing data or mismatch: "${time}" does not match the format "${format}".`);
        }

        return build({ms: parsed.ms, tz: parsed.tz ?? zone});
    }

    static rawCreateFromFormat({format, time, tz}: {format: string; time: string; tz?: TzInput}): Carbon {
        return Carbon.createFromFormat({format, time, tz});
    }

    /** Parse with Moment-style tokens (`DD/MM/YYYY HH:mm`). */
    static createFromIsoFormat({format, time, tz}: {format: string; time: string; tz?: TzInput}): Carbon {
        const zone = normalizeTz(tz instanceof CarbonTimeZone ? tz.getName() : tz);
        const parsed = parseIsoFormat({format, text: time, tz: zone, nowMs: nowMs()});

        if (!parsed) {
            throw new Error(`"${time}" does not match the format "${format}".`);
        }

        return build({ms: parsed.ms, tz: parsed.tz ?? zone});
    }

    /** Like `createFromFormat`, but month and day names are read in `locale`. */
    static createFromLocaleFormat({format, locale, time, tz}: {format: string; locale: string; time: string; tz?: TzInput}): Carbon {
        return Carbon.createFromFormat({format, time: Carbon.translateTimeString({text: time, from: locale, to: 'en'}), tz});
    }

    static createFromLocaleIsoFormat({format, locale, time, tz}: {format: string; locale: string; time: string; tz?: TzInput}): Carbon {
        return Carbon.createFromIsoFormat({format, time: Carbon.translateTimeString({text: time, from: locale, to: 'en'}), tz});
    }

    static parseFromLocale({time, locale, tz}: {time: string; locale?: string; tz?: TzInput}): Carbon {
        return Carbon.parse({time: Carbon.translateTimeString({text: time, from: locale ?? settings.locale, to: 'en'}), tz});
    }

    static canBeCreatedFromFormat({time, format}: {time: string; format: string}): boolean {
        try {
            const date = Carbon.createFromFormat({format, time, tz: 'UTC'});
            return date.isValid() && date.format(format.replace(/[!|+]/g, '')) === time.trim();
        } catch {
            return false;
        }
    }

    static hasFormat({time, format}: {time: string; format: string}): boolean {
        return matchesPhpFormat({format, text: time});
    }

    static hasFormatWithModifiers({time, format}: {time: string; format: string}): boolean {
        return matchesPhpFormat({format, text: time});
    }

    static hasRelativeKeywords(text: string): boolean {
        return /\b(now|today|tomorrow|yesterday|midnight|noon|ago|next|last|previous|this|first day of|last day of|[+-]\s*\d+)\b|[+-]\d+\s*[a-z]+/i.test(
            text,
        );
    }

    static fromSerialized(value: string): Carbon {
        const data = JSON.parse(value) as {ms: number; tz?: string};
        return build({ms: data.ms, tz: data.tz});
    }

    // ----------------------------------------------------------------- settings

    static setTestNow(date?: DateInput): void {
        settings.testNow = date === undefined || date === null ? undefined : toCarbon(date);
    }

    static setTestNowAndTimezone({date, tz}: {date?: DateInput; tz?: TzInput}): void {
        settings.testNow = date === undefined || date === null ? undefined : new Carbon({time: date, tz});
    }

    static getTestNow(): Carbon | undefined {
        return settings.testNow;
    }

    static hasTestNow(): boolean {
        return settings.testNow !== undefined;
    }

    /** Runs `callback` with a frozen "now" and restores the previous one afterwards. */
    static withTestNow<R>({testNow, callback}: {testNow?: DateInput; callback: () => R}): R {
        const previous = settings.testNow;
        Carbon.setTestNow(testNow);

        try {
            return callback();
        } finally {
            settings.testNow = previous;
        }
    }

    /** Moves a frozen "now" forward; without one it resolves after the real delay. */
    static sleep(seconds: number): Promise<void> | void {
        if (settings.testNow) {
            settings.testNow = settings.testNow.addRealSeconds(seconds);
            return;
        }

        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    static setLocale(locale: string): void {
        settings.locale = locale;
    }

    static getLocale(): string {
        return settings.locale;
    }

    static setFallbackLocale(locale: string): void {
        settings.fallbackLocale = locale;
    }

    static getFallbackLocale(): string {
        return settings.fallbackLocale;
    }

    static executeWithLocale<R>({locale, callback}: {locale: string; callback: (locale: string) => R}): R {
        const previous = settings.locale;
        settings.locale = locale;

        try {
            return callback(locale);
        } finally {
            settings.locale = previous;
        }
    }

    static getAvailableLocales(): string[] {
        return typeof Intl.DateTimeFormat.supportedLocalesOf === 'function'
            ? Intl.DateTimeFormat.supportedLocalesOf([
                  'en',
                  'fr',
                  'de',
                  'es',
                  'it',
                  'pt',
                  'nl',
                  'ru',
                  'ja',
                  'zh',
                  'ko',
                  'ar',
                  'hi',
                  'ta',
                  'tr',
                  'pl',
                  'sv',
              ])
            : ['en'];
    }

    /** Rewrites month and day names written in one locale into another (used by the locale parsers). */
    static translateTimeString({text, from, to}: {text: string; from: string; to?: string}): string {
        const target = to ?? settings.locale;
        let result = text;
        const names: [number, 'weekday' | 'month'][] = [
            ...[0, 1, 2, 3, 4, 5, 6].map((index): [number, 'weekday' | 'month'] => [index, 'weekday']),
            ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((index): [number, 'weekday' | 'month'] => [index, 'month']),
        ];

        (['long', 'short'] as const).forEach(width => {
            names.forEach(([index, kind]) => {
                const source = localeName({locale: from, kind, index, width});
                const replacement = localeName({locale: target, kind, index, width});

                if (source !== replacement) {
                    result = result.replace(new RegExp(escapeRegExp(source), 'gi'), replacement);
                }
            });
        });

        return result;
    }

    static translateTimeStringTo({text, to}: {text: string; to?: string}): string {
        return Carbon.translateTimeString({text, from: 'en', to});
    }

    static useStrictMode(strict = true): void {
        settings.strict = strict;
    }

    static isStrictModeEnabled(): boolean {
        return settings.strict;
    }

    static useMonthsOverflow(overflow = true): void {
        settings.monthsOverflow = overflow;
    }

    static resetMonthsOverflow(): void {
        settings.monthsOverflow = true;
    }

    static shouldOverflowMonths(): boolean {
        return settings.monthsOverflow;
    }

    static useYearsOverflow(overflow = true): void {
        settings.yearsOverflow = overflow;
    }

    static resetYearsOverflow(): void {
        settings.yearsOverflow = true;
    }

    static shouldOverflowYears(): boolean {
        return settings.yearsOverflow;
    }

    static setToStringFormat(format: string): void {
        settings.toStringFormat = format;
    }

    static resetToStringFormat(): void {
        settings.toStringFormat = undefined;
    }

    static setMaxIteration(max: number): void {
        settings.maxIteration = max;
    }

    static getMaxIteration(): number {
        return settings.maxIteration;
    }

    static serializeUsing(serializer?: (date: Carbon) => unknown): void {
        settings.serializer = serializer;
    }

    static setWeekStartsAt(day: Weekday): void {
        settings.weekStartsAt = weekdayNumber(day);
    }

    static getWeekStartsAt(): number {
        return settings.weekStartsAt;
    }

    static getWeekEndsAt(): number {
        return (settings.weekStartsAt + 6) % 7;
    }

    static setWeekendDays(days: Weekday[]): void {
        settings.weekendDays = days.map(weekdayNumber);
    }

    static getWeekendDays(): number[] {
        return [...settings.weekendDays];
    }

    static getDays(): string[] {
        return [...EN_DAYS];
    }

    static setMidDayAt(hour: number): void {
        settings.midDayAt = hour;
    }

    static getMidDayAt(): number {
        return settings.midDayAt;
    }

    /** Apply several static settings at once: `{locale, monthsOverflow, weekStartsAt, weekendDays, toStringFormat, testNow}`. */
    static settings(values: {
        locale?: string;
        monthsOverflow?: boolean;
        yearsOverflow?: boolean;
        strictMode?: boolean;
        weekStartsAt?: Weekday;
        weekendDays?: Weekday[];
        toStringFormat?: string;
        testNow?: DateInput;
    }): void {
        if (values.locale !== undefined) Carbon.setLocale(values.locale);
        if (values.monthsOverflow !== undefined) settings.monthsOverflow = values.monthsOverflow;
        if (values.yearsOverflow !== undefined) settings.yearsOverflow = values.yearsOverflow;
        if (values.strictMode !== undefined) settings.strict = values.strictMode;
        if (values.weekStartsAt !== undefined) Carbon.setWeekStartsAt(values.weekStartsAt);
        if (values.weekendDays !== undefined) Carbon.setWeekendDays(values.weekendDays);
        if (values.toStringFormat !== undefined) Carbon.setToStringFormat(values.toStringFormat);
        if ('testNow' in values) Carbon.setTestNow(values.testNow);
    }

    static enableHumanDiffOption(option: HumanOption): void {
        settings.humanDiffOptions.add(option);
    }

    static disableHumanDiffOption(option: HumanOption): void {
        settings.humanDiffOptions.delete(option);
    }

    static setHumanDiffOptions(options: HumanOption[]): void {
        settings.humanDiffOptions = new Set(options);
    }

    static getHumanDiffOptions(): HumanOption[] {
        return [...settings.humanDiffOptions];
    }

    // ----------------------------------------------------------------- macros

    static macro(name: string, callback: (this: Carbon, ...args: any[]) => unknown): void {
        (Carbon.prototype as any)[name] = callback;
        settings.macros.add(name);
    }

    static mixin(methods: Record<string, (this: Carbon, ...args: any[]) => unknown>): void {
        Object.entries(methods).forEach(([name, callback]) => Carbon.macro(name, callback));
    }

    static hasMacro(name: string): boolean {
        return settings.macros.has(name);
    }

    static getMacro(name: string): ((...args: any[]) => unknown) | undefined {
        return settings.macros.has(name) ? (Carbon.prototype as any)[name] : undefined;
    }

    static resetMacros(): void {
        settings.macros.forEach(name => delete (Carbon.prototype as any)[name]);
        settings.macros.clear();
    }

    // ----------------------------------------------------------------- holidays and business days

    /** Holidays are `YYYY-MM-DD` (one day) or `MM-DD` (every year). */
    static setHolidays(days: string[]): void {
        settings.holidays = [...days];
    }

    static pushHoliday(day: string): void {
        settings.holidays.push(day);
    }

    static getHolidays(): string[] {
        return [...settings.holidays];
    }

    static resetHolidays(): void {
        settings.holidays = [];
    }

    static setBusinessDayChecker(checker?: (date: Carbon) => boolean): void {
        settings.businessDayChecker = checker;
    }

    // ----------------------------------------------------------------- internals

    private parts(): Parts {
        return partsFromWall(this.wall());
    }

    private wall(): number {
        return wallOf({ms: this._ms, tz: this._tz});
    }

    private withWall(wall: number): Carbon {
        return build({ms: msFromWall({wall, tz: this._tz}), tz: this._tz, locale: this._locale});
    }

    private at(ms: number): Carbon {
        return build({ms, tz: this._tz, locale: this._locale});
    }

    private fromParts(parts: Partial<Parts>): Carbon {
        return this.withWall(wallFromParts({...this.parts(), ...parts}));
    }

    private effectiveLocale(locale?: string) {
        return locale ?? this._locale ?? settings.locale;
    }

    // ----------------------------------------------------------------- basics

    copy(): Carbon {
        return this;
    }

    clone(): Carbon {
        return this;
    }

    avoidMutation(): Carbon {
        return this;
    }

    isMutable(): boolean {
        return false;
    }

    isImmutable(): boolean {
        return true;
    }

    toImmutable(): Carbon {
        return this;
    }

    toMutable(): Carbon {
        return this;
    }

    valueOf(): number {
        return this._ms;
    }

    isValid(): boolean {
        return !Number.isNaN(this._ms);
    }

    /** Read a value by name: `get('year')`, `get('dayOfWeek')`, `get('daysInMonth')`, `get('timestamp')` ... */
    get(name: string): unknown {
        const getter = (this as any)[name];

        if (typeof getter !== 'function') {
            throw new Error(`Unknown getter "${name}".`);
        }

        return getter.call(this);
    }

    /** Change several fields at once: `set({year: 2020, month: 2, tz: 'Asia/Tokyo'})`. */
    set(values: Record<string, number | string>): Carbon {
        return Object.entries(values).reduce<Carbon>((date, [key, value]) => {
            if (key === 'tz' || key === 'timezone') {
                return date.shiftTimezone(value);
            }

            return date.setUnit({unit: key, value: Number(value)});
        }, this);
    }

    quarter(): number {
        return Math.ceil(this.parts().month / 3);
    }

    century(): number {
        return Math.ceil(this.parts().year / 100);
    }

    millennium(): number {
        return Math.ceil(this.parts().year / 1000);
    }

    decade(): number {
        return Math.ceil(this.parts().year / 10);
    }

    /** 0 = Sunday ... 6 = Saturday. */
    dayOfWeek(): number {
        return this.parts().weekday;
    }

    dayOfWeekIso(): number {
        return this.parts().weekday || 7;
    }

    isoWeekday(): number {
        return this.dayOfWeekIso();
    }

    dayOfYear(): number {
        return dayOfYear(this.parts());
    }

    daysInMonth(): number {
        return daysInMonth(this.parts());
    }

    daysInYear(): number {
        return isLeapYear(this.parts().year) ? 366 : 365;
    }

    /** ISO week number. */
    week(): number {
        return isoWeek(this.parts()).week;
    }

    weekOfYear(): number {
        return this.week();
    }

    isoWeek(): number {
        return this.week();
    }

    weekYear(): number {
        return isoWeek(this.parts()).year;
    }

    isoWeekYear(): number {
        return this.weekYear();
    }

    weeksInYear(): number {
        return isoWeeksInYear(this.weekYear());
    }

    isoWeeksInYear(): number {
        return this.weeksInYear();
    }

    weekOfMonth(): number {
        const p = this.parts();
        const offset = (partsFromWall(wallFromParts({year: p.year, month: p.month, day: 1})).weekday - settings.weekStartsAt + 7) % 7;
        return Math.ceil((p.day + offset) / 7);
    }

    weeksInMonth(): number {
        return this.endOfMonth().weekOfMonth();
    }

    dayOfMonth(): number {
        return this.parts().day;
    }

    getDaysFromStartOfWeek(weekday?: Weekday): number {
        const day = weekday === undefined ? this.dayOfWeek() : weekdayNumber(weekday);
        return (day - settings.weekStartsAt + 7) % 7;
    }

    setDaysFromStartOfWeek({days, weekday}: {days: number; weekday?: Weekday}): Carbon {
        const current = this.getDaysFromStartOfWeek(weekday);
        return this.addDays(days - current);
    }

    timestamp(): number;
    timestamp(value: number): Carbon;
    timestamp(value?: number): number | Carbon {
        return value === undefined ? Math.floor(this._ms / 1000) : this.at(Math.round(value * 1000));
    }

    getTimestamp(): number {
        return Math.floor(this._ms / 1000);
    }

    getTimestampMs(): number {
        return this._ms;
    }

    getPreciseTimestamp(precision = 6): number {
        return this._ms * 10 ** (precision - 3);
    }

    getMicrosecond(): number {
        return this.parts().millisecond * 1000;
    }

    setTimestamp(timestamp: number): Carbon {
        return this.timestamp(timestamp);
    }

    getSeason(): 'winter' | 'spring' | 'summer' | 'autumn' {
        const month = this.parts().month;
        return month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
    }

    isInWinter(): boolean {
        return this.getSeason() === 'winter';
    }

    isInSpring(): boolean {
        return this.getSeason() === 'spring';
    }

    isInSummer(): boolean {
        return this.getSeason() === 'summer';
    }

    isInFall(): boolean {
        return this.getSeason() === 'autumn';
    }

    ordinal(unit: string): string {
        const value = this.get(unit);

        if (typeof value !== 'number') {
            throw new Error(`"${unit}" is not a numeric unit.`);
        }

        return `${value}${ordinalSuffix(value)}`;
    }

    secondsSinceMidnight(): number {
        return Math.floor((this.wall() - this.startOfDay().wall()) / 1000);
    }

    secondsUntilEndOfDay(): number {
        return Math.floor((this.endOfDay().wall() - this.wall()) / 1000);
    }

    // ----------------------------------------------------------------- time zones

    getTimezone(): CarbonTimeZone {
        return new CarbonTimeZone(this._tz);
    }

    tz(): CarbonTimeZone;
    tz(zone: TzInput): Carbon;
    tz(zone?: TzInput): CarbonTimeZone | Carbon {
        return zone === undefined ? this.getTimezone() : this.setTimezone(zone);
    }

    timezone(): CarbonTimeZone;
    timezone(zone: TzInput): Carbon;
    timezone(zone?: TzInput): CarbonTimeZone | Carbon {
        return zone === undefined ? this.getTimezone() : this.setTimezone(zone);
    }

    getTimezoneName(): string {
        return tzDisplayName(this._tz);
    }

    /** Same instant, shown in another zone. */
    setTimezone(zone: TzInput): Carbon {
        return build({ms: this._ms, tz: normalizeTz(zone instanceof CarbonTimeZone ? zone.getName() : zone), locale: this._locale});
    }

    /** Same wall-clock time, in another zone (so the instant changes). */
    shiftTimezone(zone: TzInput): Carbon {
        const tz = normalizeTz(zone instanceof CarbonTimeZone ? zone.getName() : zone);
        return build({ms: msFromWall({wall: this.wall(), tz}), tz, locale: this._locale});
    }

    utc(): Carbon {
        return this.setTimezone('UTC');
    }

    isUtc(): boolean {
        return offsetAt({ms: this._ms, tz: this._tz}) === 0 && (this._tz === 'UTC' || this._tz === '+00:00');
    }

    isLocal(): boolean {
        return this._tz === undefined || this._tz === new Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    isDST(): boolean {
        return isDst({ms: this._ms, tz: this._tz});
    }

    /** Offset from UTC in seconds. */
    getOffset(): number {
        return offsetAt({ms: this._ms, tz: this._tz});
    }

    /** With no argument the offset in minutes; with one, a copy using that fixed offset in minutes. */
    utcOffset(): number;
    utcOffset(minutes: number): Carbon;
    utcOffset(minutes?: number): number | Carbon {
        return minutes === undefined ? this.getOffset() / 60 : this.setTimezone(minutes / 60);
    }

    getOffsetString(separator = ':'): string {
        return formatOffset({seconds: this.getOffset(), colon: separator === ':'}).replace(':', separator);
    }

    offsetHours(): number {
        return this.getOffset() / 3600;
    }

    offsetMinutes(): number {
        return this.getOffset() / 60;
    }

    // ----------------------------------------------------------------- locale

    locale(): string;
    locale(locale: string): Carbon;
    locale(locale?: string): string | Carbon {
        return locale === undefined ? this.effectiveLocale() : build({ms: this._ms, tz: this._tz, locale});
    }

    setLocale(locale: string): Carbon {
        return this.locale(locale);
    }

    getTranslatedDayName(locale?: string): string {
        return localeName({locale: this.effectiveLocale(locale), kind: 'weekday', index: this.parts().weekday, width: 'long'});
    }

    getTranslatedShortDayName(locale?: string): string {
        return localeName({locale: this.effectiveLocale(locale), kind: 'weekday', index: this.parts().weekday, width: 'short'});
    }

    getTranslatedMinDayName(locale?: string): string {
        return localeName({locale: this.effectiveLocale(locale), kind: 'weekday', index: this.parts().weekday, width: 'short'}).slice(0, 2);
    }

    getTranslatedMonthName(locale?: string): string {
        return localeName({locale: this.effectiveLocale(locale), kind: 'month', index: this.parts().month, width: 'long'});
    }

    getTranslatedShortMonthName(locale?: string): string {
        return localeName({locale: this.effectiveLocale(locale), kind: 'month', index: this.parts().month, width: 'short'});
    }

    // ----------------------------------------------------------------- setters

    setDate({year, month, day}: {year: number; month: number; day: number}): Carbon {
        return this.fromParts({year, month, day});
    }

    setTime({hour, minute = 0, second = 0, millisecond = 0}: {hour: number; minute?: number; second?: number; millisecond?: number}): Carbon {
        return this.fromParts({hour, minute, second, millisecond});
    }

    setDateTime({
        year,
        month,
        day,
        hour,
        minute = 0,
        second = 0,
        millisecond = 0,
    }: {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute?: number;
        second?: number;
        millisecond?: number;
    }): Carbon {
        return this.fromParts({year, month, day, hour, minute, second, millisecond});
    }

    setDateFrom(date: DateInput): Carbon {
        const p = toCarbon(date, this._tz).parts();
        return this.fromParts({year: p.year, month: p.month, day: p.day});
    }

    setTimeFrom(date: DateInput): Carbon {
        const p = toCarbon(date, this._tz).parts();
        return this.fromParts({hour: p.hour, minute: p.minute, second: p.second, millisecond: p.millisecond});
    }

    setDateTimeFrom(date: DateInput): Carbon {
        return this.setDateFrom(date).setTimeFrom(date);
    }

    setTimeFromTimeString(time: string): Carbon {
        const parsed = interpret({text: time, baseMs: this._ms, tz: this._tz});
        return this.setTimeFrom(this.at(parsed.ms));
    }

    /** Set the ISO year, week and weekday (1 = Monday). */
    setISODate({year, week, day = 1}: {year: number; week: number; day?: number}): Carbon {
        const jan4 = wallFromParts({year, month: 1, day: 4});
        const mondayOfWeek1 = jan4 - ((partsFromWall(jan4).weekday + 6) % 7) * DAY;
        const p = this.parts();
        const target = partsFromWall(mondayOfWeek1 + ((week - 1) * 7 + (day - 1)) * DAY);

        return this.fromParts({
            year: target.year,
            month: target.month,
            day: target.day,
            hour: p.hour,
            minute: p.minute,
            second: p.second,
            millisecond: p.millisecond,
        });
    }

    /** Set one field by unit name. Out-of-range values roll over unless `overflow` is false. */
    setUnit({unit, value, overflow = true}: {unit: string; value: number; overflow?: boolean}): Carbon {
        const u = normalizeUnit(unit);
        const p = this.parts();

        switch (u) {
            case 'year': {
                const day = overflow ? p.day : Math.min(p.day, daysInMonth({year: value, month: p.month}));
                return this.fromParts({year: value, day});
            }
            case 'month': {
                const total = p.year * 12 + (value - 1);
                const year = Math.floor(total / 12);
                const month = total - year * 12 + 1;
                return this.fromParts({year, month, day: overflow ? p.day : Math.min(p.day, daysInMonth({year, month}))});
            }
            case 'day':
                return this.fromParts({day: value});
            case 'hour':
                return this.fromParts({hour: value});
            case 'minute':
                return this.fromParts({minute: value});
            case 'second':
                return this.fromParts({second: value});
            case 'millisecond':
                return this.fromParts({millisecond: value});
            case 'microsecond':
                return this.fromParts({millisecond: Math.floor(value / 1000)});
            case 'quarter':
                return this.setUnit({unit: 'month', value: (value - 1) * 3 + (((p.month - 1) % 3) + 1), overflow});
            case 'week':
                return this.setISODate({year: this.weekYear(), week: value, day: this.dayOfWeekIso()});
            default:
                throw new Error(`Cannot set the ${u} directly.`);
        }
    }

    setUnitNoOverflow({unit, value, limit}: {unit: string; value: number; limit?: string}): Carbon {
        const result = this.setUnit({unit, value, overflow: false});
        return limit ? result.min(this.endOf(limit)) : result;
    }

    // ----------------------------------------------------------------- add / sub

    /** Add `value` of any unit. Calendar units follow months/years overflow rules unless `overflow` is given. */
    addUnit({unit, value = 1, overflow}: {unit: string; value?: number; overflow?: boolean}): Carbon {
        const u = normalizeUnit(unit);
        const monthsPer = MONTHS_PER[u];

        if (monthsPer !== undefined) {
            const useOverflow = overflow ?? (u === 'month' || u === 'quarter' ? settings.monthsOverflow : settings.yearsOverflow);
            return this.addMonthsOnWall({months: Math.trunc(value) * monthsPer, overflow: useOverflow});
        }

        if (u === 'day' || u === 'week') {
            return this.withWall(this.wall() + value * (u === 'week' ? 7 : 1) * DAY);
        }

        return this.at(Math.round(this._ms + value * (FIXED_MS[u] as number)));
    }

    subUnit({unit, value = 1, overflow}: {unit: string; value?: number; overflow?: boolean}): Carbon {
        return this.addUnit({unit, value: -value, overflow});
    }

    addUnitNoOverflow({unit, value = 1}: {unit: string; value?: number}): Carbon {
        return this.addUnit({unit, value, overflow: false});
    }

    subUnitNoOverflow({unit, value = 1}: {unit: string; value?: number}): Carbon {
        return this.addUnit({unit, value: -value, overflow: false});
    }

    /** Adds elapsed time, so a "day" is always 24 hours even across a DST change. */
    addRealUnit({unit, value = 1}: {unit: string; value?: number}): Carbon {
        const u = normalizeUnit(unit);
        const fixed = FIXED_MS[u];
        return fixed === undefined ? this.addUnit({unit: u, value}) : this.at(Math.round(this._ms + value * fixed));
    }

    subRealUnit({unit, value = 1}: {unit: string; value?: number}): Carbon {
        return this.addRealUnit({unit, value: -value});
    }

    addRealSeconds(value = 1): Carbon {
        return this.addRealUnit({unit: 'second', value});
    }

    /** Adds in UTC: elapsed time for fixed units, UTC calendar maths for months and above. */
    addUTCUnit({unit, value = 1}: {unit: string; value?: number}): Carbon {
        const u = normalizeUnit(unit);

        if (FIXED_MS[u] !== undefined) {
            return this.addRealUnit({unit: u, value});
        }

        return this.setTimezone('UTC').addUnit({unit: u, value}).setTimezone(this._tz);
    }

    subUTCUnit({unit, value = 1}: {unit: string; value?: number}): Carbon {
        return this.addUTCUnit({unit, value: -value});
    }

    private addMonthsOnWall({months, overflow}: {months: number; overflow: boolean}): Carbon {
        const p = this.parts();
        const total = p.year * 12 + (p.month - 1) + months;
        const year = Math.floor(total / 12);
        const month = total - year * 12 + 1;
        const day = overflow ? p.day : Math.min(p.day, daysInMonth({year, month}));

        return this.fromParts({year, month, day});
    }

    /** Add an interval: a `CarbonInterval`, `{days: 2, hours: 3}` or text like `'1 day 2 hours'`. */
    add(interval: CarbonInterval | IntervalValues | string): Carbon {
        const spec = CarbonInterval.make(interval);
        const sign = spec.isInverted() ? -1 : 1;
        const months = sign * (spec.years() * 12 + spec.months());
        let result: Carbon = months ? this.addMonthsOnWall({months, overflow: settings.monthsOverflow}) : this;

        if (spec.days()) {
            result = result.addDays(sign * spec.days());
        }

        const elapsed = (spec.hours() * HOUR + spec.minutes() * MINUTE + spec.seconds() * SECOND + spec.totalMilliseconds()) * sign;
        return elapsed ? result.at(Math.round(result._ms + elapsed)) : result;
    }

    sub(interval: CarbonInterval | IntervalValues | string): Carbon {
        return this.add(CarbonInterval.make(interval).invert());
    }

    subtract(interval: CarbonInterval | IntervalValues | string): Carbon {
        return this.sub(interval);
    }

    rawAdd(interval: CarbonInterval | IntervalValues | string): Carbon {
        return this.add(interval);
    }

    rawSub(interval: CarbonInterval | IntervalValues | string): Carbon {
        return this.sub(interval);
    }

    /** Move by weekdays (Mon-Fri), keeping the time of day. */
    addWeekdays(value = 1): Carbon {
        return this.stepDays({count: value, skip: day => day.isWeekend()});
    }

    subWeekdays(value = 1): Carbon {
        return this.addWeekdays(-value);
    }

    addWeekday(value = 1): Carbon {
        return this.addWeekdays(value);
    }

    subWeekday(value = 1): Carbon {
        return this.addWeekdays(-value);
    }

    addBusinessDays(value = 1): Carbon {
        return this.stepDays({count: value, skip: day => !day.isBusinessDay()});
    }

    subBusinessDays(value = 1): Carbon {
        return this.addBusinessDays(-value);
    }

    addBusinessDay(value = 1): Carbon {
        return this.addBusinessDays(value);
    }

    subBusinessDay(value = 1): Carbon {
        return this.addBusinessDays(-value);
    }

    subtractBusinessDay(value = 1): Carbon {
        return this.addBusinessDays(-value);
    }

    subtractBusinessDays(value = 1): Carbon {
        return this.addBusinessDays(-value);
    }

    private stepDays({count, skip}: {count: number; skip: (day: Carbon) => boolean}): Carbon {
        const step = count < 0 ? -1 : 1;
        let result: Carbon = this;

        for (let remaining = Math.abs(Math.trunc(count)); remaining > 0;) {
            result = result.addDays(step);

            if (!skip(result)) {
                remaining--;
            }
        }

        return result;
    }

    // ----------------------------------------------------------------- boundaries

    startOf(unit: string): Carbon {
        const u = unit === 'season' ? 'season' : normalizeUnit(unit);
        return this.withWall(startWall({wall: this.wall(), unit: u, weekStart: settings.weekStartsAt}));
    }

    endOf(unit: string): Carbon {
        const u = unit === 'season' ? 'season' : normalizeUnit(unit);
        const start = startWall({wall: this.wall(), unit: u, weekStart: settings.weekStartsAt});
        return this.withWall(nextWall({start, unit: u}) - 1);
    }

    startOfSeason(): Carbon {
        return this.startOf('season');
    }

    endOfSeason(): Carbon {
        return this.endOf('season');
    }

    /** Round down to a multiple of `precision` units (`floorUnit({unit: 'minute', precision: 15})`). */
    floorUnit({unit, precision = 1}: {unit: string; precision?: number}): Carbon {
        const u = normalizeUnit(unit);
        const p = this.parts();
        const down = (value: number, base = 0) => Math.floor((value - base) / precision) * precision + base;

        switch (u) {
            case 'millisecond':
                return this.fromParts({millisecond: down(p.millisecond)});
            case 'second':
                return this.fromParts({second: down(p.second), millisecond: 0});
            case 'minute':
                return this.fromParts({minute: down(p.minute), second: 0, millisecond: 0});
            case 'hour':
                return this.fromParts({hour: down(p.hour), minute: 0, second: 0, millisecond: 0});
            case 'day':
                return this.fromParts({day: down(p.day, 1), hour: 0, minute: 0, second: 0, millisecond: 0});
            case 'month':
                return this.fromParts({month: down(p.month, 1), day: 1, hour: 0, minute: 0, second: 0, millisecond: 0});
            case 'year':
                return this.fromParts({year: down(p.year), month: 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0});
            case 'microsecond':
                return this;
            default:
                return this.startOf(u);
        }
    }

    ceilUnit({unit, precision = 1}: {unit: string; precision?: number}): Carbon {
        const floored = this.floorUnit({unit, precision});
        return floored._ms === this._ms ? this : floored.addUnit({unit, value: precision, overflow: true});
    }

    /** Nearest boundary; exact halves round up. */
    roundUnit({unit, precision = 1}: {unit: string; precision?: number}): Carbon {
        const floored = this.floorUnit({unit, precision});
        const ceiled = this.ceilUnit({unit, precision});
        return this._ms - floored._ms < ceiled._ms - this._ms ? floored : ceiled;
    }

    floor(unit = 'second'): Carbon {
        return this.floorUnit({unit});
    }

    ceil(unit = 'second'): Carbon {
        return this.ceilUnit({unit});
    }

    round(unit = 'second'): Carbon {
        return this.roundUnit({unit});
    }

    midDay(): Carbon {
        return this.fromParts({hour: settings.midDayAt, minute: 0, second: 0, millisecond: 0});
    }

    // ----------------------------------------------------------------- first / last / nth

    private rangeBounds(unit: 'month' | 'quarter' | 'year') {
        const start = this.startOf(unit).startOfDay();
        return {start, end: this.endOf(unit).startOfDay()};
    }

    private firstOf({unit, dayOfWeek}: {unit: 'month' | 'quarter' | 'year'; dayOfWeek?: Weekday}): Carbon {
        const {start} = this.rangeBounds(unit);
        return dayOfWeek === undefined ? start : start.nextOrSameWeekday(dayOfWeek);
    }

    private lastOf({unit, dayOfWeek}: {unit: 'month' | 'quarter' | 'year'; dayOfWeek?: Weekday}): Carbon {
        const {end} = this.rangeBounds(unit);
        return dayOfWeek === undefined ? end : end.previousOrSameWeekday(dayOfWeek);
    }

    private nthOf({unit, nth, dayOfWeek}: {unit: 'month' | 'quarter' | 'year'; nth: number; dayOfWeek: Weekday}): Carbon | false {
        const {start, end} = this.rangeBounds(unit);
        const date = start.nextOrSameWeekday(dayOfWeek).addWeeks(nth - 1);
        return nth >= 1 && date._ms <= end._ms ? date : false;
    }

    private nextOrSameWeekday(dayOfWeek: Weekday): Carbon {
        const diff = (weekdayNumber(dayOfWeek) - this.dayOfWeek() + 7) % 7;
        return this.addDays(diff);
    }

    private previousOrSameWeekday(dayOfWeek: Weekday): Carbon {
        const diff = (this.dayOfWeek() - weekdayNumber(dayOfWeek) + 7) % 7;
        return this.subDays(diff);
    }

    firstOfMonth(dayOfWeek?: Weekday): Carbon {
        return this.firstOf({unit: 'month', dayOfWeek});
    }

    lastOfMonth(dayOfWeek?: Weekday): Carbon {
        return this.lastOf({unit: 'month', dayOfWeek});
    }

    nthOfMonth({nth, dayOfWeek}: {nth: number; dayOfWeek: Weekday}): Carbon | false {
        return this.nthOf({unit: 'month', nth, dayOfWeek});
    }

    firstOfQuarter(dayOfWeek?: Weekday): Carbon {
        return this.firstOf({unit: 'quarter', dayOfWeek});
    }

    lastOfQuarter(dayOfWeek?: Weekday): Carbon {
        return this.lastOf({unit: 'quarter', dayOfWeek});
    }

    nthOfQuarter({nth, dayOfWeek}: {nth: number; dayOfWeek: Weekday}): Carbon | false {
        return this.nthOf({unit: 'quarter', nth, dayOfWeek});
    }

    firstOfYear(dayOfWeek?: Weekday): Carbon {
        return this.firstOf({unit: 'year', dayOfWeek});
    }

    lastOfYear(dayOfWeek?: Weekday): Carbon {
        return this.lastOf({unit: 'year', dayOfWeek});
    }

    nthOfYear({nth, dayOfWeek}: {nth: number; dayOfWeek: Weekday}): Carbon | false {
        return this.nthOf({unit: 'year', nth, dayOfWeek});
    }

    /** Next occurrence of a weekday (default: same weekday next week) at midnight. */
    next(dayOfWeek?: Weekday): Carbon {
        const target = dayOfWeek === undefined ? this.dayOfWeek() : weekdayNumber(dayOfWeek);
        const diff = ((target - this.dayOfWeek() + 6) % 7) + 1;
        return this.startOfDay().addDays(diff);
    }

    previous(dayOfWeek?: Weekday): Carbon {
        const target = dayOfWeek === undefined ? this.dayOfWeek() : weekdayNumber(dayOfWeek);
        const diff = ((this.dayOfWeek() - target + 6) % 7) + 1;
        return this.startOfDay().subDays(diff);
    }

    nextWeekday(): Carbon {
        return this.addWeekdays(1);
    }

    previousWeekday(): Carbon {
        return this.subWeekdays(1);
    }

    nextWeekendDay(): Carbon {
        return this.stepDays({count: 1, skip: day => !day.isWeekend()});
    }

    previousWeekendDay(): Carbon {
        return this.stepDays({count: -1, skip: day => !day.isWeekend()});
    }

    nextBusinessDay(): Carbon {
        return this.addBusinessDays(1);
    }

    previousBusinessDay(): Carbon {
        return this.subBusinessDays(1);
    }

    currentOrNextBusinessDay(): Carbon {
        return this.isBusinessDay() ? this : this.nextBusinessDay();
    }

    currentOrPreviousBusinessDay(): Carbon {
        return this.isBusinessDay() ? this : this.previousBusinessDay();
    }

    getBusinessDaysInMonth(): Carbon[] {
        const start = this.startOfMonth();
        const days: Carbon[] = [];

        for (let day = start; day.month() === start.month(); day = day.addDay()) {
            if (day.isBusinessDay()) {
                days.push(day);
            }
        }

        return days;
    }

    // ----------------------------------------------------------------- comparison

    private cmp(other: DateInput): number {
        return Math.sign(this._ms - toCarbon(other, this._tz)._ms);
    }

    eq(other: DateInput): boolean {
        return this.cmp(other) === 0;
    }

    equalTo(other: DateInput): boolean {
        return this.eq(other);
    }

    ne(other: DateInput): boolean {
        return this.cmp(other) !== 0;
    }

    notEqualTo(other: DateInput): boolean {
        return this.ne(other);
    }

    gt(other: DateInput): boolean {
        return this.cmp(other) > 0;
    }

    greaterThan(other: DateInput): boolean {
        return this.gt(other);
    }

    isAfter(other: DateInput): boolean {
        return this.gt(other);
    }

    gte(other: DateInput): boolean {
        return this.cmp(other) >= 0;
    }

    greaterThanOrEqualTo(other: DateInput): boolean {
        return this.gte(other);
    }

    lt(other: DateInput): boolean {
        return this.cmp(other) < 0;
    }

    lessThan(other: DateInput): boolean {
        return this.lt(other);
    }

    isBefore(other: DateInput): boolean {
        return this.lt(other);
    }

    lte(other: DateInput): boolean {
        return this.cmp(other) <= 0;
    }

    lessThanOrEqualTo(other: DateInput): boolean {
        return this.lte(other);
    }

    between({start, end, equal = true}: {start: DateInput; end: DateInput; equal?: boolean}): boolean {
        let first = toCarbon(start, this._tz);
        let last = toCarbon(end, this._tz);

        if (first.gt(last)) {
            [first, last] = [last, first];
        }

        return equal ? this.gte(first) && this.lte(last) : this.gt(first) && this.lt(last);
    }

    betweenIncluded({start, end}: {start: DateInput; end: DateInput}): boolean {
        return this.between({start, end, equal: true});
    }

    betweenExcluded({start, end}: {start: DateInput; end: DateInput}): boolean {
        return this.between({start, end, equal: false});
    }

    isBetween({start, end, equal = true}: {start: DateInput; end: DateInput; equal?: boolean}): boolean {
        return this.between({start, end, equal});
    }

    /** True when the formatted values match: `isSameAs({format: 'Y-m', date})`. */
    isSameAs({format, date}: {format: string; date?: DateInput}): boolean {
        const other = toCarbon(date ?? Carbon.now(this._tz), this._tz);
        return this.format(format) === other.format(format);
    }

    isSameUnit({unit, date, ofSameYear = true}: {unit: string; date?: DateInput; ofSameYear?: boolean}): boolean {
        const u = normalizeUnit(unit);
        const other = toCarbon(date ?? Carbon.now(this._tz), this._tz);

        if (!ofSameYear && u === 'month') {
            return this.month() === other.month();
        }

        if (u === 'microsecond' || u === 'millisecond') {
            return this._ms === other._ms;
        }

        return this.startOf(u)._ms === other.startOf(u)._ms;
    }

    isCurrentUnit(unit: string): boolean {
        return this.isSameUnit({unit, date: Carbon.now(this._tz)});
    }

    isStartOfUnit({unit}: {unit: string}): boolean {
        const u = normalizeUnit(unit);
        const start = this.startOf(u);
        return u === 'microsecond' || u === 'millisecond' ? this._ms === start._ms : Math.floor(this._ms / 1000) === Math.floor(start._ms / 1000);
    }

    isEndOfUnit({unit}: {unit: string}): boolean {
        const u = normalizeUnit(unit);
        const end = this.endOf(u);
        return u === 'microsecond' || u === 'millisecond' ? this._ms === end._ms : Math.floor(this._ms / 1000) === Math.floor(end._ms / 1000);
    }

    isStartOfTime(): boolean {
        return this._ms === -8.64e15;
    }

    isEndOfTime(): boolean {
        return this._ms === 8.64e15;
    }

    isModifiableUnit(unit: string): boolean {
        try {
            normalizeUnit(unit);
            return true;
        } catch {
            return false;
        }
    }

    isPast(): boolean {
        return this._ms < nowMs();
    }

    isFuture(): boolean {
        return this._ms > nowMs();
    }

    isNowOrPast(): boolean {
        return this._ms <= nowMs();
    }

    isNowOrFuture(): boolean {
        return this._ms >= nowMs();
    }

    isToday(): boolean {
        return this.isCurrentUnit('day');
    }

    isTomorrow(): boolean {
        return this.isSameUnit({unit: 'day', date: Carbon.now(this._tz).addDay()});
    }

    isYesterday(): boolean {
        return this.isSameUnit({unit: 'day', date: Carbon.now(this._tz).subDay()});
    }

    isLeapYear(): boolean {
        return isLeapYear(this.parts().year);
    }

    isLongYear(): boolean {
        return isoWeeksInYear(this.parts().year) === 53;
    }

    isLongIsoYear(): boolean {
        return isoWeeksInYear(this.weekYear()) === 53;
    }

    isMidnight(): boolean {
        const p = this.parts();
        return p.hour === 0 && p.minute === 0 && p.second === 0;
    }

    isMidday(): boolean {
        const p = this.parts();
        return p.hour === settings.midDayAt && p.minute === 0 && p.second === 0;
    }

    isLastOfMonth(): boolean {
        return this.day() === this.daysInMonth();
    }

    isBirthday(date?: DateInput): boolean {
        const other = toCarbon(date ?? Carbon.now(this._tz), this._tz);
        return this.format('md') === other.format('md');
    }

    isDayOfWeek(day: Weekday): boolean {
        return this.dayOfWeek() === weekdayNumber(day);
    }

    isMonday(): boolean {
        return this.dayOfWeek() === 1;
    }

    isTuesday(): boolean {
        return this.dayOfWeek() === 2;
    }

    isWednesday(): boolean {
        return this.dayOfWeek() === 3;
    }

    isThursday(): boolean {
        return this.dayOfWeek() === 4;
    }

    isFriday(): boolean {
        return this.dayOfWeek() === 5;
    }

    isSaturday(): boolean {
        return this.dayOfWeek() === 6;
    }

    isSunday(): boolean {
        return this.dayOfWeek() === 0;
    }

    isWeekend(): boolean {
        return settings.weekendDays.includes(this.dayOfWeek());
    }

    isWeekday(): boolean {
        return !this.isWeekend();
    }

    isHoliday(): boolean {
        const full = this.format('Y-m-d');
        const recurring = this.format('m-d');
        return settings.holidays.some(day => day === full || day === recurring);
    }

    isBusinessDay(): boolean {
        return settings.businessDayChecker ? settings.businessDayChecker(this) : this.isWeekday() && !this.isHoliday();
    }

    min(other: DateInput = Carbon.now(this._tz)): Carbon {
        const date = toCarbon(other);
        return this._ms <= date._ms ? this : date;
    }

    minimum(other?: DateInput): Carbon {
        return this.min(other);
    }

    max(other: DateInput = Carbon.now(this._tz)): Carbon {
        const date = toCarbon(other);
        return this._ms >= date._ms ? this : date;
    }

    maximum(other?: DateInput): Carbon {
        return this.max(other);
    }

    average(other?: DateInput): Carbon {
        const date = toCarbon(other ?? Carbon.now(this._tz));
        return this.at(Math.round((this._ms + date._ms) / 2));
    }

    /** The date nearest to this one. */
    closest({dates}: {dates: DateInput[]}): Carbon {
        return dates
            .map(date => toCarbon(date))
            .reduce((best, date) => (Math.abs(date._ms - this._ms) < Math.abs(best._ms - this._ms) ? date : best));
    }

    farthest({dates}: {dates: DateInput[]}): Carbon {
        return dates
            .map(date => toCarbon(date))
            .reduce((best, date) => (Math.abs(date._ms - this._ms) > Math.abs(best._ms - this._ms) ? date : best));
    }

    // ----------------------------------------------------------------- differences

    private resolveDiff(arg: DateInput | {other?: DateInput; absolute?: boolean}) {
        const options = asOptions<{other?: DateInput; absolute?: boolean}>({arg, key: 'other'});
        return {other: toCarbon(options.other ?? Carbon.now(this._tz), this._tz), absolute: Boolean(options.absolute)};
    }

    /** Whole months from `this` to `other` plus the fraction of the month in progress (negative when earlier). */
    private fractionalMonthsTo(other: Carbon): number {
        const sign = other._ms >= this._ms ? 1 : -1;
        const a = this.parts();
        const b = other.setTimezone(this._tz).parts();
        let months = (b.year - a.year) * 12 + (b.month - a.month);

        if (sign > 0 && this.addMonthsOnWall({months, overflow: false})._ms > other._ms) months--;
        if (sign < 0 && this.addMonthsOnWall({months, overflow: false})._ms < other._ms) months++;

        const base = this.addMonthsOnWall({months, overflow: false});
        const next = this.addMonthsOnWall({months: months + sign, overflow: false});
        const span = next._ms - base._ms;

        return span === 0 ? months : months + sign * ((other._ms - base._ms) / span);
    }

    /** Signed difference `other - this` in a unit, as a float. Pass `{other, absolute: true}` for the magnitude. */
    diffInUnit({unit, other, absolute = false, utc = false}: {unit: string; other?: DateInput; absolute?: boolean; utc?: boolean}): number {
        const u = normalizeUnit(unit);
        const a = utc ? this.setTimezone('UTC') : this;
        const b = toCarbon(other ?? Carbon.now(a._tz), a._tz);
        const fixed = FIXED_MS[u];
        let value: number;

        if (u === 'day' || u === 'week') {
            value = (b.wall() - a.wall()) / (u === 'week' ? WEEK : DAY);
        } else if (fixed !== undefined) {
            value = (b._ms - a._ms) / fixed;
        } else {
            value = a.fractionalMonthsTo(b) / (MONTHS_PER[u] as number);
        }

        return absolute ? Math.abs(value) : value;
    }

    /** Calendar difference as an interval (years, months, days, hours ...). */
    diff(arg?: DateInput | {other?: DateInput; absolute?: boolean}): CarbonInterval {
        const {other, absolute} = this.resolveDiff(arg);
        const invert = other._ms < this._ms;
        const [from, to] = invert ? [other.setTimezone(this._tz), this] : [this, other.setTimezone(this._tz)];
        const totalMonths = Math.trunc(from.fractionalMonthsTo(to));
        const middle = from.addMonthsOnWall({months: totalMonths, overflow: false});
        const rest = to.wall() - middle.wall();

        return CarbonInterval.create({
            years: Math.floor(totalMonths / 12),
            months: totalMonths % 12,
            days: Math.floor(rest / DAY),
            hours: Math.floor((rest % DAY) / HOUR),
            minutes: Math.floor((rest % HOUR) / MINUTE),
            seconds: Math.floor((rest % MINUTE) / SECOND),
            milliseconds: rest % SECOND,
            invert: invert && !absolute,
            totalDays: Math.floor((to.wall() - from.wall()) / DAY),
        });
    }

    diffAsCarbonInterval(arg?: DateInput | {other?: DateInput; absolute?: boolean}): CarbonInterval {
        return this.diff(arg);
    }

    diffAsDateInterval(arg?: DateInput | {other?: DateInput; absolute?: boolean}): CarbonInterval {
        return this.diff(arg);
    }

    /** Count the units between two dates for which `filter` returns true, stepping one `unit` at a time. */
    diffFiltered({
        interval,
        filter,
        other,
        absolute = false,
    }: {
        interval: CarbonInterval | string;
        filter: (date: Carbon) => boolean;
        other?: DateInput;
        absolute?: boolean;
    }): number {
        const target = toCarbon(other ?? Carbon.now(this._tz), this._tz);
        const [from, to, sign] = target._ms < this._ms ? [target, this, -1] : [this, target, 1];
        const step = CarbonInterval.make(interval);
        let count = 0;
        let guard = 0;

        for (let date = from; date._ms < to._ms && guard < 1_000_000; date = date.add(step), guard++) {
            if (filter(date)) {
                count++;
            }
        }

        return absolute ? count : count * sign;
    }

    diffInDaysFiltered({filter, other, absolute = false}: {filter: (date: Carbon) => boolean; other?: DateInput; absolute?: boolean}): number {
        return this.diffFiltered({interval: '1 day', filter, other, absolute});
    }

    diffInHoursFiltered({filter, other, absolute = false}: {filter: (date: Carbon) => boolean; other?: DateInput; absolute?: boolean}): number {
        return this.diffFiltered({interval: '1 hour', filter, other, absolute});
    }

    diffInWeekdays(arg?: DateInput | {other?: DateInput; absolute?: boolean}): number {
        const {other, absolute} = this.resolveDiff(arg);
        return this.diffFiltered({interval: '1 day', filter: day => day.isWeekday(), other, absolute});
    }

    diffInWeekendDays(arg?: DateInput | {other?: DateInput; absolute?: boolean}): number {
        const {other, absolute} = this.resolveDiff(arg);
        return this.diffFiltered({interval: '1 day', filter: day => day.isWeekend(), other, absolute});
    }

    diffInBusinessDays(arg?: DateInput | {other?: DateInput; absolute?: boolean}): number {
        const {other, absolute} = this.resolveDiff(arg);
        return this.diffFiltered({interval: '1 day', filter: day => day.isBusinessDay(), other, absolute});
    }

    /** Human wording such as "2 hours ago" or "1 week after". */
    diffForHumans(arg?: DateInput | HumanOptions): string {
        const options = asOptions<HumanOptions>({arg, key: 'other'});
        const {syntax = 'auto', short = false, parts = 1, join = false} = options;
        const active = new Set<HumanOption>([...settings.humanDiffOptions, ...(options.options ?? [])]);
        const hasOther = options.other !== undefined && options.other !== null;
        const other = toCarbon(options.other ?? Carbon.now(this._tz), this._tz);
        const future = this._ms > other._ms;
        const interval = this.diff({other, absolute: true});
        const locale = options.locale ?? this._locale ?? settings.locale;

        const values: [string, number][] = [
            ['year', interval.years()],
            ['month', interval.months()],
            ['week', Math.floor(interval.days() / 7)],
            ['day', interval.days() % 7],
            ['hour', interval.hours()],
            ['minute', interval.minutes()],
            ['second', interval.seconds()],
        ];
        const nonZero = values.filter(([, count]) => count > 0);

        if (nonZero.length === 0 && active.has('noZeroDiff')) {
            nonZero.push(['second', 1]);
        }

        const relativeToNow = syntax === 'relativeToNow' || (syntax === 'auto' && !hasOther);
        const suffix = syntax === 'absolute' ? '' : relativeToNow ? (future ? 'from now' : 'ago') : future ? 'after' : 'before';

        if (!short && locale !== 'en' && !locale.startsWith('en-') && parts === 1 && relativeToNow && typeof Intl.RelativeTimeFormat === 'function') {
            const [unit, count] = nonZero[0] ?? ['second', 0];
            return new Intl.RelativeTimeFormat(locale).format(future ? count : -count, unit as Intl.RelativeTimeFormatUnit);
        }

        if (active.has('oneDayWords') && relativeToNow && nonZero.length === 1 && nonZero[0]?.[0] === 'day' && nonZero[0][1] === 1) {
            return future ? 'tomorrow' : 'yesterday';
        }

        if (active.has('twoDayWords') && relativeToNow && nonZero.length === 1 && nonZero[0]?.[0] === 'day' && nonZero[0][1] === 2) {
            return future ? 'after tomorrow' : 'before yesterday';
        }

        if (active.has('justNow') && relativeToNow && nonZero.length === 0) {
            return 'just now';
        }

        const chosen = nonZero.length ? nonZero.slice(0, Math.max(1, parts)) : [['second', 0] as [string, number]];
        const words = chosen.map(([unit, count]) => (short ? `${count}${SHORT_UNITS[unit]}` : `${count} ${unit}${count === 1 ? '' : 's'}`));
        const separator = join === true ? [', ', ' and '] : typeof join === 'string' ? [join, join] : Array.isArray(join) ? join : [' ', ' '];
        const text = words.length > 1 ? `${words.slice(0, -1).join(separator[0])}${separator[1]}${words[words.length - 1]}` : (words[0] as string);

        return suffix ? `${text} ${suffix}` : text;
    }

    ago(options: HumanOptions = {}): string {
        return this.diffForHumans(options);
    }

    fromNow(options: HumanOptions = {}): string {
        return this.diffForHumans(options);
    }

    since(arg?: DateInput | HumanOptions): string {
        return this.diffForHumans(arg);
    }

    from(arg?: DateInput | HumanOptions): string {
        return this.diffForHumans(arg);
    }

    /** Describes `other` relative to this date: "2 days before". */
    to(arg?: DateInput | HumanOptions): string {
        const options = asOptions<HumanOptions>({arg, key: 'other'});
        const other = toCarbon(options.other ?? Carbon.now(this._tz), this._tz);
        return other.diffForHumans({...options, other: this, syntax: options.syntax ?? (options.other === undefined ? 'relativeToNow' : undefined)});
    }

    until(arg?: DateInput | HumanOptions): string {
        return this.to(arg);
    }

    toNow(options: HumanOptions = {}): string {
        return this.to(options);
    }

    longAbsoluteDiffForHumans(other?: DateInput, parts = 1): string {
        return this.diffForHumans({other, syntax: 'absolute', parts});
    }

    shortAbsoluteDiffForHumans(other?: DateInput, parts = 1): string {
        return this.diffForHumans({other, syntax: 'absolute', parts, short: true});
    }

    longRelativeDiffForHumans(other?: DateInput, parts = 1): string {
        return this.diffForHumans({other, syntax: 'relativeToOther', parts});
    }

    shortRelativeDiffForHumans(other?: DateInput, parts = 1): string {
        return this.diffForHumans({other, syntax: 'relativeToOther', parts, short: true});
    }

    longRelativeToNowDiffForHumans(parts = 1): string {
        return this.diffForHumans({syntax: 'relativeToNow', parts});
    }

    shortRelativeToNowDiffForHumans(parts = 1): string {
        return this.diffForHumans({syntax: 'relativeToNow', parts, short: true});
    }

    longRelativeToOtherDiffForHumans(other?: DateInput, parts = 1): string {
        return this.diffForHumans({other, syntax: 'relativeToOther', parts});
    }

    shortRelativeToOtherDiffForHumans(other?: DateInput, parts = 1): string {
        return this.diffForHumans({other, syntax: 'relativeToOther', parts, short: true});
    }

    timespan(other?: DateInput): string {
        return this.diff({other, absolute: true}).forHumans({parts: 7, join: true});
    }

    /** "Today at 2:30 PM", "Tomorrow at ...", "Last Monday at ...", or `MM/DD/YYYY`. */
    calendar({
        reference,
        formats = {},
    }: {
        reference?: DateInput;
        formats?: Partial<Record<'sameDay' | 'nextDay' | 'nextWeek' | 'lastDay' | 'lastWeek' | 'sameElse', string>>;
    } = {}): string {
        const ref = toCarbon(reference ?? Carbon.now(this._tz), this._tz);
        const days = Math.round((this.startOfDay().wall() - ref.startOfDay().wall()) / DAY);
        const defaults = {
            sameDay: '[Today at] LT',
            nextDay: '[Tomorrow at] LT',
            nextWeek: 'dddd [at] LT',
            lastDay: '[Yesterday at] LT',
            lastWeek: '[Last] dddd [at] LT',
            sameElse: 'L',
            ...formats,
        };
        const key =
            days === 0
                ? 'sameDay'
                : days === 1
                  ? 'nextDay'
                  : days === -1
                    ? 'lastDay'
                    : days > 1 && days < 7
                      ? 'nextWeek'
                      : days < -1 && days > -7
                        ? 'lastWeek'
                        : 'sameElse';

        return this.isoFormat(defaults[key]);
    }

    // ----------------------------------------------------------------- modify and periods

    /** Apply relative text: `modify('next monday')`, `modify('+1 week 2 days')`, `modify('last day of this month')`. */
    modify(text: string): Carbon {
        const parsed = interpret({text, baseMs: this._ms, tz: this._tz});
        return this.at(parsed.ms);
    }

    change(text: string): Carbon {
        return this.modify(text);
    }

    /** Iterate from this date to `end` in steps (default one day). */
    toPeriod({end, step = 1, unit = 'day'}: {end?: DateInput | number; step?: number; unit?: string} = {}): CarbonPeriod {
        return CarbonPeriod.create({
            start: this,
            end: typeof end === 'number' || end === undefined || end === null ? undefined : toCarbon(end, this._tz),
            recurrences: typeof end === 'number' ? end : undefined,
            interval: CarbonInterval.create({[PLURAL_NAME[normalizeUnit(unit)]]: step} as IntervalValues),
        });
    }

    range({end, step = 1, unit = 'day'}: {end: DateInput | number; step?: number; unit?: string}): CarbonPeriod {
        return this.toPeriod({end, step, unit});
    }

    // ----------------------------------------------------------------- formatting

    format(format: string): string {
        return phpFormat({ms: this._ms, tz: this._tz, format});
    }

    rawFormat(format: string): string {
        return this.format(format);
    }

    translatedFormat(format: string, locale?: string): string {
        return phpFormat({ms: this._ms, tz: this._tz, format, locale: this.effectiveLocale(locale)});
    }

    isoFormat(format = 'YYYY-MM-DDTHH:mm:ssZ', locale?: string): string {
        return isoFormat({ms: this._ms, tz: this._tz, format, locale: this.effectiveLocale(locale)});
    }

    toString(): string {
        return this.format(settings.toStringFormat ?? 'Y-m-d H:i:s');
    }

    toDateString(): string {
        return this.format('Y-m-d');
    }

    toTimeString(precision?: 'minute' | 'second' | 'millisecond'): string {
        return this.format(precision === 'minute' ? 'H:i' : precision === 'millisecond' ? 'H:i:s.v' : 'H:i:s');
    }

    toDateTimeString(precision?: 'minute' | 'second' | 'millisecond'): string {
        return `${this.toDateString()} ${this.toTimeString(precision)}`;
    }

    toDateTimeLocalString(precision?: 'minute' | 'second' | 'millisecond'): string {
        return `${this.toDateString()}T${this.toTimeString(precision)}`;
    }

    toDayDateTimeString(): string {
        return this.format('D, M j, Y g:i A');
    }

    toFormattedDateString(): string {
        return this.format('M j, Y');
    }

    toFormattedDayDateString(): string {
        return this.format('D, M j, Y');
    }

    toAtomString(): string {
        return this.format('Y-m-d\\TH:i:sP');
    }

    toCookieString(): string {
        return this.format('l, d-M-Y H:i:s T');
    }

    toIso8601String(): string {
        return this.toAtomString();
    }

    toIso8601ZuluString(precision?: 'second' | 'millisecond'): string {
        return this.utc().format(precision === 'millisecond' ? 'Y-m-d\\TH:i:s.v\\Z' : 'Y-m-d\\TH:i:s\\Z');
    }

    toISOString(): string {
        return this.utc().format('Y-m-d\\TH:i:s.v\\Z');
    }

    toJSON(): string {
        return this.toISOString();
    }

    jsonSerialize(): unknown {
        return settings.serializer ? settings.serializer(this) : this.toISOString();
    }

    toRfc822String(): string {
        return this.format('D, d M y H:i:s O');
    }

    toRfc850String(): string {
        return this.format('l, d-M-y H:i:s T');
    }

    toRfc1036String(): string {
        return this.format('D, d M y H:i:s O');
    }

    toRfc1123String(): string {
        return this.format('D, d M Y H:i:s O');
    }

    toRfc2822String(): string {
        return this.format('D, d M Y H:i:s O');
    }

    toRfc3339String(extended = false): string {
        return this.format(extended ? 'Y-m-d\\TH:i:s.vP' : 'Y-m-d\\TH:i:sP');
    }

    toRfc7231String(): string {
        return this.utc().format('D, d M Y H:i:s \\G\\M\\T');
    }

    toRssString(): string {
        return this.format('D, d M Y H:i:s O');
    }

    toW3cString(): string {
        return this.toAtomString();
    }

    toDate(): Date {
        return new Date(this._ms);
    }

    toDateTime(): Date {
        return this.toDate();
    }

    toDateTimeImmutable(): Date {
        return this.toDate();
    }

    toObject(): Record<string, unknown> {
        const p = this.parts();

        return {
            year: p.year,
            month: p.month,
            day: p.day,
            dayOfWeek: p.weekday,
            dayOfYear: this.dayOfYear(),
            hour: p.hour,
            minute: p.minute,
            second: p.second,
            micro: p.millisecond * 1000,
            timestamp: this.getTimestamp(),
            formatted: this.format('Y-m-d H:i:s'),
            timezone: this.getTimezoneName(),
        };
    }

    toArray(): Record<string, unknown> {
        return {
            ...this.toObject(),
            weekOfYear: this.weekOfYear(),
            daysInMonth: this.daysInMonth(),
            quarter: this.quarter(),
            weekOfMonth: this.weekOfMonth(),
            offset: this.getOffset(),
            offsetHours: this.offsetHours(),
            dst: this.isDST(),
        };
    }

    serialize(): string {
        return JSON.stringify({ms: this._ms, tz: this._tz});
    }

    /**
     * Loose "is it ..." check: `is('Monday')`, `is('March')`, `is('2024')`, `is('2024-03')`, `is('2024-03-05')`,
     * `is('10:30')`, `is('2024-03-05 10:30:00')`. Anything else is parsed and compared to the second.
     */
    is(expected: string): boolean {
        const text = expected.trim();
        const lower = text.toLowerCase();
        const weekday = Object.keys(WEEKDAY_INDEX).find(name => name === lower || name.slice(0, 3) === lower);
        const month = EN_MONTHS.findIndex(name => name.toLowerCase() === lower || name.toLowerCase().slice(0, 3) === lower);

        if (weekday !== undefined) {
            return this.dayOfWeek() === WEEKDAY_INDEX[weekday];
        }

        if (month >= 0) {
            return this.month() === month + 1;
        }

        const formats: [RegExp, string][] = [
            [/^\d{4}$/, 'Y'],
            [/^\d{4}-\d{2}$/, 'Y-m'],
            [/^\d{4}-\d{2}-\d{2}$/, 'Y-m-d'],
            [/^\d{1,2}:\d{2}$/, 'H:i'],
            [/^\d{1,2}:\d{2}:\d{2}$/, 'H:i:s'],
            [/^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}$/, 'Y-m-d H:i'],
            [/^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}:\d{2}$/, 'Y-m-d H:i:s'],
        ];
        const match = formats.find(([pattern]) => pattern.test(text));

        if (match) {
            const value = match[1].startsWith('H') ? text.replace(/^(\d):/, '0$1:') : text.replace(/ (\d):/, ' 0$1:');
            return this.format(match[1]) === value;
        }

        return this.isSameUnit({unit: 'second', date: new Carbon({time: text, tz: this._tz})});
    }

    meridiem(lowercase = false): string {
        return this.format(lowercase ? 'a' : 'A');
    }

    /** Day of week (0 = Sunday); with a value, moves to that weekday of the same week. */
    weekday(): number;
    weekday(value: number): Carbon;
    weekday(value?: number): number | Carbon {
        return value === undefined ? this.dayOfWeek() : this.addDays(value - this.dayOfWeek());
    }

    nowWithSameTz(): Carbon {
        return Carbon.now(this._tz);
    }

    /** Zero-padded unit value: `getPaddedUnit('month')` -> "03". */
    getPaddedUnit({unit, length = 2}: {unit: string; length?: number}): string {
        return pad(Number(this.get(unit)), length);
    }

    getSettings(): {tz: string; locale: string; toStringFormat?: string} {
        return {tz: this.getTimezoneName(), locale: this.effectiveLocale(), toStringFormat: settings.toStringFormat};
    }

    static rawParse(time?: DateInput | {time?: DateInput; tz?: TzInput}): Carbon {
        return Carbon.parse(time);
    }

    static getLastErrors(): null {
        return null;
    }

    static singularUnit(unit: string): Unit {
        return normalizeUnit(unit);
    }

    static pluralUnit(unit: string): string {
        return PLURAL_NAME[normalizeUnit(unit)];
    }

    static translateNumber(value: number): string {
        return String(value);
    }

    /** Default `calendar()` formats; override per call with `calendar({formats})`. */
    static getCalendarFormats(): Record<string, string> {
        return {
            sameDay: '[Today at] LT',
            nextDay: '[Tomorrow at] LT',
            nextWeek: 'dddd [at] LT',
            lastDay: '[Yesterday at] LT',
            lastWeek: '[Last] dddd [at] LT',
            sameElse: 'L',
        };
    }
}

/**
 * The big method families of Carbon (`addDays`, `startOfMonth`, `isSameWeek`, `diffInHours`, `dayOfYear`,
 * `hoursInDay` ...) are generated from `UNIT_TABLE`. The types below are derived from the same table, so
 * the declared names and the installed methods cannot drift apart.
 */
type FormsOf<K extends Unit, W extends 's' | 'p'> = (typeof UNIT_TABLE)[K][W][number];
type Forms<K extends Unit = Unit> = FormsOf<K, 's'> | FormsOf<K, 'p'>;
type Singular<K extends Unit = Unit> = FormsOf<K, 's'>;
type Plural<K extends Unit = Unit> = FormsOf<K, 'p'>;
type CalendarUnit = 'month' | 'quarter' | 'year' | 'decade' | 'century' | 'millennium';
type FieldUnit = 'microsecond' | 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';
type BoundaryUnit = Exclude<Unit, 'microsecond'>;
type OverflowSuffix = 'NoOverflow' | 'WithNoOverflow' | 'WithOverflow' | 'WithoutOverflow';
type Above<X extends Unit, T extends readonly Unit[] = typeof ORDER> = T extends readonly [infer H, ...infer R extends Unit[]]
    ? H extends X
        ? R[number]
        : Above<X, R>
    : never;

type Step = (value?: number) => Carbon;
type DiffArg = DateInput | {other?: DateInput; absolute?: boolean};
type SameArg = DateInput | {date?: DateInput; ofSameYear?: boolean};
type UntilArg = DateInput | {end?: DateInput; step?: number};
type FieldAccessor = {(): number; (value: number): Carbon};

type OfMethods = {[X in Unit as `${X}Of${Capitalize<Above<X>>}`]: () => number};
type InMethods = {[X in Unit as `${(typeof PLURAL_NAME)[X]}In${Capitalize<Above<X>>}`]: () => number};

interface Carbon
    extends
        Record<`add${Forms}` | `sub${Forms}` | `addUTC${Forms}` | `subUTC${Forms}`, Step>,
        Record<`${'add' | 'sub'}${Forms<CalendarUnit>}${OverflowSuffix}`, Step>,
        Record<`startOf${Singular<BoundaryUnit>}` | `endOf${Singular<BoundaryUnit>}`, () => Carbon>,
        Record<`isStartOf${Singular<BoundaryUnit>}` | `isEndOf${Singular<BoundaryUnit>}`, () => boolean>,
        Record<`isSame${Singular}`, (arg?: SameArg) => boolean>,
        Record<`isCurrent${Singular}` | `isLast${Singular}` | `isNext${Singular}`, () => boolean>,
        Record<`floor${Forms}` | `ceil${Forms}` | `round${Forms}`, (precision?: number) => Carbon>,
        Record<`diffIn${Plural}` | `diffInUTC${Plural}`, (arg?: DiffArg) => number>,
        Record<`${Uncapitalize<Plural>}Until`, (arg?: UntilArg) => CarbonPeriod>,
        Record<`set${Forms<FieldUnit>}`, (value: number) => Carbon>,
        Record<Uncapitalize<Forms<FieldUnit>>, FieldAccessor>,
        OfMethods,
        InMethods {}

const UNIT_KEYS = Object.keys(UNIT_TABLE) as Unit[];
const CALENDAR_SUFFIXES: [string, boolean][] = [
    ['NoOverflow', false],
    ['WithNoOverflow', false],
    ['WithoutOverflow', false],
    ['WithOverflow', true],
];

const define = (name: string, method: (this: Carbon, ...args: any[]) => unknown) => {
    if (!(name in Carbon.prototype)) {
        Object.defineProperty(Carbon.prototype, name, {value: method, writable: true, configurable: true});
    }
};

const internal = (date: Carbon) => date as unknown as {parts(): Parts; wall(): number; _tz: TimeZoneName};

const readField = ({date, unit}: {date: Carbon; unit: Unit}) => {
    const p = internal(date).parts();

    switch (unit) {
        case 'microsecond':
            return p.millisecond * 1000;
        case 'millisecond':
            return p.millisecond;
        case 'second':
            return p.second;
        case 'minute':
            return p.minute;
        case 'hour':
            return p.hour;
        case 'day':
            return p.day;
        case 'month':
            return p.month;
        default:
            return p.year;
    }
};

const monthIndex = (date: Carbon) => {
    const p = internal(date).parts();
    return p.year * 12 + p.month - 1;
};

/** How many whole `unit`s separate two boundary-aligned dates. */
const unitsBetween = ({from, to, unit}: {from: Carbon; to: Carbon; unit: Unit}) => {
    const months = MONTHS_PER[unit];

    if (months !== undefined) {
        return Math.round((monthIndex(to) - monthIndex(from)) / months);
    }

    if (unit === 'day' || unit === 'week') {
        return Math.round((internal(to).wall() - internal(from).wall()) / (unit === 'week' ? WEEK : DAY));
    }

    return Math.round((to.valueOf() - from.valueOf()) / (FIXED_MS[unit] as number));
};

/** Position of the date's `unit` inside its enclosing `container` (1-based from days up, 0-based below). */
const positionOf = ({date, unit, container}: {date: Carbon; unit: Unit; container: Unit}) => {
    const start = date.startOf(unit);
    const origin = date.startOf(container);
    const base = ORDER.indexOf(unit) < ORDER.indexOf('day') ? 0 : 1;
    const from = unit === 'week' ? origin.startOf('week') : origin;

    return Math.floor(unitsBetween({from, to: start, unit})) + base;
};

const countInside = ({date, unit, container}: {date: Carbon; unit: Unit; container: Unit}) => {
    const start = date.startOf(container);
    return unitsBetween({from: start, to: start.addUnit({unit: container, value: 1}), unit});
};

UNIT_KEYS.forEach((unit, unitIndex) => {
    const singular: readonly string[] = UNIT_TABLE[unit].s;
    const plural: readonly string[] = UNIT_TABLE[unit].p;
    const calendar = isCalendarUnit(unit);

    [...singular, ...plural].forEach(form => {
        define(`add${form}`, function (value = 1) {
            return this.addUnit({unit, value});
        });
        define(`sub${form}`, function (value = 1) {
            return this.addUnit({unit, value: -value});
        });
        define(`addUTC${form}`, function (value = 1) {
            return this.addUTCUnit({unit, value});
        });
        define(`subUTC${form}`, function (value = 1) {
            return this.addUTCUnit({unit, value: -value});
        });
        define(`floor${form}`, function (precision = 1) {
            return this.floorUnit({unit, precision});
        });
        define(`ceil${form}`, function (precision = 1) {
            return this.ceilUnit({unit, precision});
        });
        define(`round${form}`, function (precision = 1) {
            return this.roundUnit({unit, precision});
        });

        if (calendar) {
            CALENDAR_SUFFIXES.forEach(([suffix, overflow]) => {
                define(`add${form}${suffix}`, function (value = 1) {
                    return this.addUnit({unit, value, overflow});
                });
                define(`sub${form}${suffix}`, function (value = 1) {
                    return this.addUnit({unit, value: -value, overflow});
                });
            });
        }

        if (['microsecond', 'millisecond', 'second', 'minute', 'hour', 'day', 'month', 'year'].includes(unit)) {
            define(`set${form}`, function (value: number) {
                return this.setUnit({unit, value});
            });
            define(lowerFirst(form), function (value?: number) {
                return value === undefined ? readField({date: this, unit}) : this.setUnit({unit, value});
            });
        }
    });

    singular.forEach(form => {
        if (unit !== 'microsecond') {
            define(`startOf${form}`, function () {
                return this.startOf(unit);
            });
            define(`endOf${form}`, function () {
                return this.endOf(unit);
            });
            define(`isStartOf${form}`, function () {
                return this.isStartOfUnit({unit});
            });
            define(`isEndOf${form}`, function () {
                return this.isEndOfUnit({unit});
            });
        }

        define(`isSame${form}`, function (arg?: SameArg) {
            const options = asOptions<{date?: DateInput; ofSameYear?: boolean}>({arg, key: 'date'});
            return this.isSameUnit({unit, date: options.date, ofSameYear: options.ofSameYear});
        });
        define(`isCurrent${form}`, function () {
            return this.isCurrentUnit(unit);
        });
        define(`isLast${form}`, function () {
            return this.isSameUnit({unit, date: Carbon.now(internal(this)._tz).addUnit({unit, value: -1, overflow: false})});
        });
        define(`isNext${form}`, function () {
            return this.isSameUnit({unit, date: Carbon.now(internal(this)._tz).addUnit({unit, value: 1, overflow: false})});
        });
    });

    plural.forEach(form => {
        define(`diffIn${form}`, function (arg?: DiffArg) {
            const options = asOptions<{other?: DateInput; absolute?: boolean}>({arg, key: 'other'});
            return this.diffInUnit({unit, other: options.other, absolute: options.absolute});
        });
        define(`diffInUTC${form}`, function (arg?: DiffArg) {
            const options = asOptions<{other?: DateInput; absolute?: boolean}>({arg, key: 'other'});
            return this.diffInUnit({unit, other: options.other, absolute: options.absolute, utc: true});
        });
        define(`${lowerFirst(form)}Until`, function (arg?: UntilArg) {
            const options = asOptions<{end?: DateInput; step?: number}>({arg, key: 'end'});
            return this.toPeriod({end: options.end ?? this, step: options.step, unit});
        });
    });

    UNIT_KEYS.slice(unitIndex + 1).forEach(container => {
        define(`${unit}Of${capitalize(container)}`, function () {
            return positionOf({date: this, unit, container});
        });
        define(`${PLURAL_NAME[unit]}In${capitalize(container)}`, function () {
            return countInside({date: this, unit, container});
        });
    });
});

type IntervalValues = {
    years?: number;
    months?: number;
    weeks?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
    microseconds?: number;
    invert?: boolean;
    totalDays?: number;
};

type IntervalInit = IntervalValues & {start?: Carbon; end?: Carbon; step?: number | ((date: Carbon) => Carbon); original?: string};

const cascadeFactors = {
    millisecondsPerSecond: 1000,
    secondsPerMinute: 60,
    minutesPerHour: 60,
    hoursPerDay: 24,
    daysPerWeek: 7,
    weeksPerMonth: 4,
    monthsPerYear: 12,
    daysPerMonth: 30,
};

const INTERVAL_UNIT_WORDS: [RegExp, keyof IntervalValues][] = [
    [/^(?:y|yr|yrs|year|years)$/, 'years'],
    [/^(?:mo|mos|month|months)$/, 'months'],
    [/^(?:w|wk|wks|week|weeks)$/, 'weeks'],
    [/^(?:d|day|days)$/, 'days'],
    [/^(?:h|hr|hrs|hour|hours)$/, 'hours'],
    [/^(?:m|min|mins|minute|minutes)$/, 'minutes'],
    [/^(?:s|sec|secs|second|seconds)$/, 'seconds'],
    [/^(?:ms|msec|msecs|millisecond|milliseconds)$/, 'milliseconds'],
    [/^(?:µs|us|microsecond|microseconds)$/, 'microseconds'],
];

/** Immutable span of time, like PHP's `DateInterval` extended by CarbonInterval. Components may be negative. */
class CarbonInterval {
    private readonly _y: number;
    private readonly _m: number;
    private readonly _d: number;
    private readonly _h: number;
    private readonly _i: number;
    private readonly _s: number;
    private readonly _f: number;
    private readonly _inv: boolean;
    private readonly _totalDays: number | undefined;
    private readonly _start: Carbon | undefined;
    private readonly _end: Carbon | undefined;
    private readonly _step: number | ((date: Carbon) => Carbon) | undefined;
    private readonly _original: string | undefined;

    constructor(values: IntervalInit = {}) {
        this._y = values.years ?? 0;
        this._m = values.months ?? 0;
        this._d = (values.days ?? 0) + (values.weeks ?? 0) * 7;
        this._h = values.hours ?? 0;
        this._i = values.minutes ?? 0;
        this._s = values.seconds ?? 0;
        this._f = (values.milliseconds ?? 0) + (values.microseconds ?? 0) / 1000;
        this._inv = Boolean(values.invert);
        this._totalDays = values.totalDays;
        this._start = values.start;
        this._end = values.end;
        this._step = values.step;
        this._original = values.original;
    }

    // ----------------------------------------------------------------- creation

    static create(values: IntervalValues = {}): CarbonInterval {
        return new CarbonInterval(values);
    }

    /** `'1 year 2 months'`, `'3d 4h'`, an ISO spec like `'P1DT2H'`, or `{days: 2}`. */
    static make(value: CarbonInterval | IntervalValues | string): CarbonInterval {
        if (value instanceof CarbonInterval) {
            return value;
        }

        if (typeof value === 'string') {
            return /^[+-]?P/i.test(value.trim()) ? CarbonInterval.fromSpec(value.trim()) : CarbonInterval.fromString(value);
        }

        return new CarbonInterval(value);
    }

    static instance(value: CarbonInterval | IntervalValues | string): CarbonInterval {
        return CarbonInterval.make(value);
    }

    static cast(value: CarbonInterval | IntervalValues | string): CarbonInterval {
        return CarbonInterval.make(value);
    }

    static fromString(text: string): CarbonInterval {
        const values: Record<string, number> = {};
        let negate = false;
        let matched = false;

        text.toLowerCase().replace(/([+-]?\d+(?:\.\d+)?|an?)\s*([a-zµ]+)/g, (whole, amount: string, word: string) => {
            if (word === 'ago') {
                negate = true;
                return whole;
            }

            const entry = INTERVAL_UNIT_WORDS.find(([pattern]) => pattern.test(word));

            if (entry) {
                values[entry[1]] = (values[entry[1]] ?? 0) + (/^[+-]?\d/.test(amount) ? Number(amount) : 1);
                matched = true;
            }

            return whole;
        });

        if (/\bago\b/i.test(text)) {
            negate = true;
        }

        if (!matched) {
            throw new Error(`Could not read the interval "${text}".`);
        }

        const signed = Object.fromEntries(Object.entries(values).map(([key, amount]) => [key, negate ? -amount : amount]));
        return new CarbonInterval({...signed, original: text});
    }

    static createFromDateString(text: string): CarbonInterval {
        return CarbonInterval.fromString(text);
    }

    private static fromSpec(spec: string): CarbonInterval {
        const match = spec.match(
            /^([+-])?P(?:(-?\d+(?:\.\d+)?)Y)?(?:(-?\d+(?:\.\d+)?)M)?(?:(-?\d+(?:\.\d+)?)W)?(?:(-?\d+(?:\.\d+)?)D)?(?:T(?:(-?\d+(?:\.\d+)?)H)?(?:(-?\d+(?:\.\d+)?)M)?(?:(-?\d+(?:\.\d+)?)S)?)?$/i,
        );

        if (!match) {
            throw new Error(`Unknown or bad format (${spec}).`);
        }

        const [, sign, y, m, w, d, h, i, s] = match;
        const seconds = Number(s ?? 0);

        return new CarbonInterval({
            years: Number(y ?? 0),
            months: Number(m ?? 0),
            weeks: Number(w ?? 0),
            days: Number(d ?? 0),
            hours: Number(h ?? 0),
            minutes: Number(i ?? 0),
            seconds: Math.trunc(seconds),
            milliseconds: Math.round((seconds % 1) * 1000),
            invert: sign === '-',
            original: spec,
        });
    }

    /** Read an interval written with PHP interval format letters, e.g. format `'%d days %h hours'`. */
    static createFromFormat({format, interval}: {format: string; interval: string}): CarbonInterval {
        const letters: Record<string, keyof IntervalValues> = {
            y: 'years',
            Y: 'years',
            m: 'months',
            M: 'months',
            d: 'days',
            D: 'days',
            h: 'hours',
            H: 'hours',
            i: 'minutes',
            I: 'minutes',
            s: 'seconds',
            S: 'seconds',
            f: 'milliseconds',
            F: 'milliseconds',
        };
        const prefixed = format.includes('%');
        const keys: (keyof IntervalValues)[] = [];
        let source = '';

        for (let index = 0; index < format.length; index++) {
            const char = format.charAt(index);
            const letter = prefixed ? (char === '%' ? format.charAt(index + 1) : '') : char;
            const key = letters[letter];

            if (key) {
                keys.push(key);
                source += '(-?\\d+)';
                index += prefixed ? 1 : 0;
            } else {
                source += escapeRegExp(char);
            }
        }

        const match = interval.match(new RegExp(`^${source}$`));

        if (!match) {
            throw new Error(`"${interval}" does not match the format "${format}".`);
        }

        const values: Record<string, number> = {};
        keys.forEach((key, index) => {
            values[key] = (values[key] ?? 0) + Number(match[index + 1]);
        });

        return new CarbonInterval(values);
    }

    static diff({start, end, absolute = false}: {start: DateInput; end: DateInput; absolute?: boolean}): CarbonInterval {
        return toCarbon(start).diff({other: end, absolute});
    }

    static years(value = 1): CarbonInterval {
        return new CarbonInterval({years: value});
    }

    static months(value = 1): CarbonInterval {
        return new CarbonInterval({months: value});
    }

    static weeks(value = 1): CarbonInterval {
        return new CarbonInterval({weeks: value});
    }

    static days(value = 1): CarbonInterval {
        return new CarbonInterval({days: value});
    }

    static hours(value = 1): CarbonInterval {
        return new CarbonInterval({hours: value});
    }

    static minutes(value = 1): CarbonInterval {
        return new CarbonInterval({minutes: value});
    }

    static seconds(value = 1): CarbonInterval {
        return new CarbonInterval({seconds: value});
    }

    static milliseconds(value = 1): CarbonInterval {
        return new CarbonInterval({milliseconds: value});
    }

    static microseconds(value = 1): CarbonInterval {
        return new CarbonInterval({microseconds: value});
    }

    // ----------------------------------------------------------------- cascade factors

    static getCascadeFactors(): typeof cascadeFactors {
        return {...cascadeFactors};
    }

    static setCascadeFactors(factors: Partial<typeof cascadeFactors>): void {
        Object.assign(cascadeFactors, factors);
    }

    static getFactor({from, to}: {from: string; to: string}): number {
        const order = ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];
        const steps = [
            cascadeFactors.millisecondsPerSecond,
            cascadeFactors.secondsPerMinute,
            cascadeFactors.minutesPerHour,
            cascadeFactors.hoursPerDay,
            cascadeFactors.daysPerWeek,
            cascadeFactors.weeksPerMonth,
            cascadeFactors.monthsPerYear,
        ];
        const a = order.indexOf(from);
        const b = order.indexOf(to);

        if (a < 0 || b < 0) {
            throw new Error(`Unknown unit "${a < 0 ? from : to}".`);
        }

        const [low, high] = a < b ? [a, b] : [b, a];
        const product = steps.slice(low, high).reduce((total, step) => total * step, 1);
        return a < b ? product : 1 / product;
    }

    static getFactorWithDefault({from, to}: {from: string; to: string}): number {
        try {
            return CarbonInterval.getFactor({from, to});
        } catch {
            return 1;
        }
    }

    static getMillisecondsPerSecond(): number {
        return cascadeFactors.millisecondsPerSecond;
    }

    static getMicrosecondsPerMillisecond(): number {
        return 1000;
    }

    static getSecondsPerMinute(): number {
        return cascadeFactors.secondsPerMinute;
    }

    static getMinutesPerHour(): number {
        return cascadeFactors.minutesPerHour;
    }

    static getHoursPerDay(): number {
        return cascadeFactors.hoursPerDay;
    }

    static getDaysPerWeek(): number {
        return cascadeFactors.daysPerWeek;
    }

    // ----------------------------------------------------------------- components

    private copyWith(values: IntervalInit): CarbonInterval {
        return new CarbonInterval({
            years: this._y,
            months: this._m,
            days: this._d,
            hours: this._h,
            minutes: this._i,
            seconds: this._s,
            milliseconds: this._f,
            invert: this._inv,
            totalDays: this._totalDays,
            start: this._start,
            end: this._end,
            step: this._step,
            ...values,
        });
    }

    years(): number;
    years(value: number): CarbonInterval;
    years(value?: number): number | CarbonInterval {
        return value === undefined ? this._y : this.copyWith({years: value});
    }

    months(): number;
    months(value: number): CarbonInterval;
    months(value?: number): number | CarbonInterval {
        return value === undefined ? this._m : this.copyWith({months: value});
    }

    /** Whole weeks inside the day count. */
    weeks(): number;
    weeks(value: number): CarbonInterval;
    weeks(value?: number): number | CarbonInterval {
        return value === undefined ? Math.trunc(this._d / 7) : this.copyWith({days: this._d % 7, weeks: value});
    }

    /** All days, including the ones that make up whole weeks. */
    days(): number;
    days(value: number): CarbonInterval;
    days(value?: number): number | CarbonInterval {
        return value === undefined ? this._d : this.copyWith({days: value});
    }

    dayzExcludeWeeks(): number {
        return this._d % 7;
    }

    hours(): number;
    hours(value: number): CarbonInterval;
    hours(value?: number): number | CarbonInterval {
        return value === undefined ? this._h : this.copyWith({hours: value});
    }

    minutes(): number;
    minutes(value: number): CarbonInterval;
    minutes(value?: number): number | CarbonInterval {
        return value === undefined ? this._i : this.copyWith({minutes: value});
    }

    seconds(): number;
    seconds(value: number): CarbonInterval;
    seconds(value?: number): number | CarbonInterval {
        return value === undefined ? this._s : this.copyWith({seconds: value});
    }

    milliseconds(): number;
    milliseconds(value: number): CarbonInterval;
    milliseconds(value?: number): number | CarbonInterval {
        return value === undefined ? Math.trunc(this._f) : this.copyWith({milliseconds: value});
    }

    microseconds(): number;
    microseconds(value: number): CarbonInterval;
    microseconds(value?: number): number | CarbonInterval {
        return value === undefined
            ? Math.round((this._f - Math.trunc(this._f)) * 1000)
            : this.copyWith({milliseconds: Math.trunc(this._f), microseconds: value});
    }

    /** Sub-second part in milliseconds, fractions included. */
    totalMilliseconds(): number {
        return this._f;
    }

    /** Days between the two dates of a `diff`, otherwise `undefined`. */
    totalDays(): number | undefined {
        return this._totalDays;
    }

    isInverted(): boolean {
        return this._inv;
    }

    get(name: string): number {
        const getter = (this as any)[name];

        if (typeof getter !== 'function') {
            throw new Error(`Unknown interval unit "${name}".`);
        }

        return getter.call(this);
    }

    set(values: IntervalValues): CarbonInterval {
        return this.copyWith(values);
    }

    weeksAndDays({weeks, days}: {weeks: number; days: number}): CarbonInterval {
        return this.copyWith({days: weeks * 7 + days});
    }

    // ----------------------------------------------------------------- arithmetic

    private signed() {
        const sign = this._inv ? -1 : 1;

        return {
            years: this._y * sign,
            months: this._m * sign,
            days: this._d * sign,
            hours: this._h * sign,
            minutes: this._i * sign,
            seconds: this._s * sign,
            milliseconds: this._f * sign,
        };
    }

    /** Component-wise sum. Also accepts `'2 days'` or `{hours: 3}`. */
    add(other: CarbonInterval | IntervalValues | string): CarbonInterval {
        const a = this.signed();
        const b = CarbonInterval.make(other).signed();

        return new CarbonInterval({
            years: a.years + b.years,
            months: a.months + b.months,
            days: a.days + b.days,
            hours: a.hours + b.hours,
            minutes: a.minutes + b.minutes,
            seconds: a.seconds + b.seconds,
            milliseconds: a.milliseconds + b.milliseconds,
        });
    }

    plus(other: CarbonInterval | IntervalValues | string): CarbonInterval {
        return this.add(other);
    }

    sub(other: CarbonInterval | IntervalValues | string): CarbonInterval {
        return this.add(CarbonInterval.make(other).invert());
    }

    subtract(other: CarbonInterval | IntervalValues | string): CarbonInterval {
        return this.sub(other);
    }

    minus(other: CarbonInterval | IntervalValues | string): CarbonInterval {
        return this.sub(other);
    }

    /** Multiply every component; fractions of a day or hour are pushed into the smaller units. */
    multiply(factor: number): CarbonInterval {
        const s = this.signed();

        const years = s.years * factor;
        const months = s.months * factor + (years % 1) * cascadeFactors.monthsPerYear;
        const days = s.days * factor + (months % 1) * cascadeFactors.daysPerMonth;
        const hours = s.hours * factor + (days % 1) * cascadeFactors.hoursPerDay;
        const minutes = s.minutes * factor + (hours % 1) * cascadeFactors.minutesPerHour;
        const seconds = s.seconds * factor + (minutes % 1) * cascadeFactors.secondsPerMinute;
        const milliseconds = s.milliseconds * factor + (seconds % 1) * cascadeFactors.millisecondsPerSecond;

        return new CarbonInterval({
            years: Math.trunc(years),
            months: Math.trunc(months),
            days: Math.trunc(days),
            hours: Math.trunc(hours),
            minutes: Math.trunc(minutes),
            seconds: Math.trunc(seconds),
            milliseconds,
        });
    }

    times(factor: number): CarbonInterval {
        return this.multiply(factor);
    }

    divide(divisor: number): CarbonInterval {
        if (divisor === 0) {
            throw new Error('Division by zero.');
        }

        return this.multiply(1 / divisor);
    }

    /** Flip the direction (past <-> future). */
    invert(value?: boolean): CarbonInterval {
        return this.copyWith({invert: value ?? !this._inv});
    }

    abs(): CarbonInterval {
        const s = this.signed();
        const negative = this.hasNegativeValues();
        const sign = negative && !this.hasPositiveValues() ? -1 : 1;

        return new CarbonInterval({
            years: Math.abs(s.years),
            months: Math.abs(s.months),
            days: Math.abs(s.days),
            hours: Math.abs(s.hours),
            minutes: Math.abs(s.minutes),
            seconds: Math.abs(s.seconds),
            milliseconds: Math.abs(s.milliseconds) * Math.abs(sign),
        });
    }

    absolute(): CarbonInterval {
        return this.abs();
    }

    hasNegativeValues(): boolean {
        return Object.values(this.signed()).some(value => value < 0);
    }

    hasPositiveValues(): boolean {
        return Object.values(this.signed()).some(value => value > 0);
    }

    isEmpty(): boolean {
        return Object.values(this.signed()).every(value => value === 0);
    }

    /** Roll small units into bigger ones: 90 minutes -> 1 hour 30 minutes, 14 months -> 1 year 2 months. */
    cascade(): CarbonInterval {
        const s = this.signed();
        const carry = (value: number, factor: number): [number, number] => [Math.trunc(value / factor), value % factor];

        const [extraSeconds, milliseconds] = carry(s.milliseconds, cascadeFactors.millisecondsPerSecond);
        const [extraMinutes, seconds] = carry(s.seconds + extraSeconds, cascadeFactors.secondsPerMinute);
        const [extraHours, minutes] = carry(s.minutes + extraMinutes, cascadeFactors.minutesPerHour);
        const [extraDays, hours] = carry(s.hours + extraHours, cascadeFactors.hoursPerDay);
        const [extraYears, months] = carry(s.months, cascadeFactors.monthsPerYear);

        return new CarbonInterval({years: s.years + extraYears, months, days: s.days + extraDays, hours, minutes, seconds, milliseconds});
    }

    optimize(): CarbonInterval {
        return this.cascade();
    }

    /** Total length in a unit, treating a month as 30 days and a year as 12 months. */
    total(unit: string): number {
        const target = normalizeUnit(unit);
        const s = this.signed();
        const months = s.years * cascadeFactors.monthsPerYear + s.months;
        const ms = (months * cascadeFactors.daysPerMonth + s.days) * DAY + s.hours * HOUR + s.minutes * MINUTE + s.seconds * SECOND + s.milliseconds;

        if (target in MONTHS_PER) {
            return ms / (cascadeFactors.daysPerMonth * DAY) / (MONTHS_PER[target] as number);
        }

        return ms / (FIXED_MS[target] as number);
    }

    private roundWith({unit, precision, mode}: {unit: string; precision: number; mode: 'floor' | 'ceil' | 'round'}): CarbonInterval {
        const target = normalizeUnit(unit);
        const amount = Math[mode](this.total(target) / precision) * precision;
        return CarbonInterval.create({[PLURAL_NAME[target]]: amount} as IntervalValues).cascade();
    }

    floor(unit = 'second'): CarbonInterval {
        return this.roundWith({unit, precision: 1, mode: 'floor'});
    }

    ceil(unit = 'second'): CarbonInterval {
        return this.roundWith({unit, precision: 1, mode: 'ceil'});
    }

    round(unit = 'second'): CarbonInterval {
        return this.roundWith({unit, precision: 1, mode: 'round'});
    }

    floorUnit({unit, precision = 1}: {unit: string; precision?: number}): CarbonInterval {
        return this.roundWith({unit, precision, mode: 'floor'});
    }

    ceilUnit({unit, precision = 1}: {unit: string; precision?: number}): CarbonInterval {
        return this.roundWith({unit, precision, mode: 'ceil'});
    }

    roundUnit({unit, precision = 1}: {unit: string; precision?: number}): CarbonInterval {
        return this.roundWith({unit, precision, mode: 'round'});
    }

    // ----------------------------------------------------------------- comparison

    /** -1, 0 or 1. Month lengths are measured from the current date, like Carbon. */
    compare(other: CarbonInterval | IntervalValues | string): number {
        const now = Carbon.now();
        const a = now.add(this).valueOf();
        const b = now.add(CarbonInterval.make(other)).valueOf();
        return Math.sign(a - b);
    }

    eq(other: CarbonInterval | IntervalValues | string): boolean {
        return this.compare(other) === 0;
    }

    equalTo(other: CarbonInterval | IntervalValues | string): boolean {
        return this.eq(other);
    }

    ne(other: CarbonInterval | IntervalValues | string): boolean {
        return this.compare(other) !== 0;
    }

    notEqualTo(other: CarbonInterval | IntervalValues | string): boolean {
        return this.ne(other);
    }

    gt(other: CarbonInterval | IntervalValues | string): boolean {
        return this.compare(other) > 0;
    }

    greaterThan(other: CarbonInterval | IntervalValues | string): boolean {
        return this.gt(other);
    }

    gte(other: CarbonInterval | IntervalValues | string): boolean {
        return this.compare(other) >= 0;
    }

    greaterThanOrEqualTo(other: CarbonInterval | IntervalValues | string): boolean {
        return this.gte(other);
    }

    lt(other: CarbonInterval | IntervalValues | string): boolean {
        return this.compare(other) < 0;
    }

    lessThan(other: CarbonInterval | IntervalValues | string): boolean {
        return this.lt(other);
    }

    lte(other: CarbonInterval | IntervalValues | string): boolean {
        return this.compare(other) <= 0;
    }

    lessThanOrEqualTo(other: CarbonInterval | IntervalValues | string): boolean {
        return this.lte(other);
    }

    between({
        start,
        end,
        equal = true,
    }: {
        start: CarbonInterval | IntervalValues | string;
        end: CarbonInterval | IntervalValues | string;
        equal?: boolean;
    }): boolean {
        return equal ? this.gte(start) && this.lte(end) : this.gt(start) && this.lt(end);
    }

    betweenIncluded({start, end}: {start: CarbonInterval | IntervalValues | string; end: CarbonInterval | IntervalValues | string}): boolean {
        return this.between({start, end, equal: true});
    }

    betweenExcluded({start, end}: {start: CarbonInterval | IntervalValues | string; end: CarbonInterval | IntervalValues | string}): boolean {
        return this.between({start, end, equal: false});
    }

    isBetween({
        start,
        end,
        equal = true,
    }: {
        start: CarbonInterval | IntervalValues | string;
        end: CarbonInterval | IntervalValues | string;
        equal?: boolean;
    }): boolean {
        return this.between({start, end, equal});
    }

    // ----------------------------------------------------------------- output

    toArray(): Record<string, number> {
        return {
            years: this._y,
            months: this._m,
            weeks: this.weeks(),
            days: this.dayzExcludeWeeks(),
            hours: this._h,
            minutes: this._i,
            seconds: this._s,
            milliseconds: this.milliseconds(),
            microseconds: this.microseconds(),
        };
    }

    getNonZeroValues(): [string, number][] {
        return Object.entries(this.toArray()).filter(([, value]) => value !== 0);
    }

    getValuesSequence(): [string, number][] {
        return this.getNonZeroValues();
    }

    /** ISO 8601 duration such as `P1Y2M3DT4H5M6S`; `PT0S` when empty. */
    spec(): string {
        const date = `${this._y ? `${this._y}Y` : ''}${this._m ? `${this._m}M` : ''}${this._d ? `${this._d}D` : ''}`;
        const seconds = this._s + this._f / 1000;
        const time = `${this._h ? `${this._h}H` : ''}${this._i ? `${this._i}M` : ''}${seconds ? `${seconds}S` : ''}`;

        return date || time ? `${this._inv ? '-' : ''}P${date}${time ? `T${time}` : ''}` : 'PT0S';
    }

    getDateIntervalSpec(): string {
        return this.spec();
    }

    original(): string {
        return this._original ?? this.spec();
    }

    /** `%y` years, `%m` months, `%d` days, `%h` `%i` `%s`, padded `%Y %M %D %H %I %S`, `%R` sign, `%a` total days, `%%`. */
    format(format: string): string {
        return format.replace(/%([a-zA-Z%])/g, (_, char: string) => {
            switch (char) {
                case 'y':
                    return String(this._y);
                case 'Y':
                    return pad(this._y, 4);
                case 'm':
                    return String(this._m);
                case 'M':
                    return pad(this._m);
                case 'd':
                    return String(this._d);
                case 'D':
                    return pad(this._d);
                case 'h':
                    return String(this._h);
                case 'H':
                    return pad(this._h);
                case 'i':
                    return String(this._i);
                case 'I':
                    return pad(this._i);
                case 's':
                    return String(this._s);
                case 'S':
                    return pad(this._s);
                case 'f':
                    return String(Math.round(this._f * 1000));
                case 'F':
                    return pad(Math.round(this._f * 1000), 6);
                case 'a':
                    return this._totalDays === undefined ? '(unknown)' : String(this._totalDays);
                case 'R':
                    return this._inv ? '-' : '+';
                case 'r':
                    return this._inv ? '-' : '';
                case 'w':
                    return String(this.weeks());
                case '%':
                    return '%';
                default:
                    return `%${char}`;
            }
        });
    }

    toString(): string {
        return this.forHumans();
    }

    /** "1 year 2 months 3 days". `parts` limits the number of units, `join: true` gives "a, b and c". */
    forHumans({
        parts,
        short = false,
        join = false,
        minimumUnit = 'second',
        skipSeconds = false,
    }: {parts?: number; short?: boolean; join?: boolean | string | [string, string]; minimumUnit?: string; skipSeconds?: boolean} = {}): string {
        const minimum = normalizeUnit(minimumUnit);
        const order: Unit[] = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];
        const values = {
            year: this._y,
            month: this._m,
            week: this.weeks(),
            day: this.dayzExcludeWeeks(),
            hour: this._h,
            minute: this._i,
            second: this._s,
            millisecond: this.milliseconds(),
        } as Record<string, number>;
        const longest = order.indexOf(minimum === 'microsecond' ? 'millisecond' : minimum);

        let chosen = order
            .filter((unit, index) => index <= longest && values[unit] !== 0 && !(skipSeconds && unit === 'second'))
            .map(unit => [unit, values[unit] as number] as [string, number]);

        if (parts !== undefined && parts > 0) {
            chosen = chosen.slice(0, parts);
        }

        if (chosen.length === 0) {
            chosen = [[order[longest] as string, 0]];
        }

        const words = chosen.map(([unit, count]) =>
            short ? `${count}${unit === 'millisecond' ? 'ms' : SHORT_UNITS[unit]}` : `${count} ${unit}${Math.abs(count) === 1 ? '' : 's'}`,
        );
        const separator = join === true ? [', ', ' and '] : typeof join === 'string' ? [join, join] : Array.isArray(join) ? join : [' ', ' '];
        const text = words.length > 1 ? `${words.slice(0, -1).join(separator[0])}${separator[1]}${words[words.length - 1]}` : (words[0] as string);

        return this._inv ? `${text} ago` : text;
    }

    // ----------------------------------------------------------------- periods

    start(date: DateInput): CarbonInterval {
        return this.copyWith({start: toCarbon(date)});
    }

    end(date: DateInput): CarbonInterval {
        return this.copyWith({end: toCarbon(date)});
    }

    stepBy(step: number | ((date: Carbon) => Carbon)): CarbonInterval {
        return this.copyWith({step});
    }

    setStep(step: number | ((date: Carbon) => Carbon)): CarbonInterval {
        return this.stepBy(step);
    }

    getStep(): number | ((date: Carbon) => Carbon) | undefined {
        return this._step;
    }

    /** Dates from `start` to `end` every interval (uses the ones set with `start()` / `end()` by default). */
    toPeriod({start, end}: {start?: DateInput; end?: DateInput | number} = {}): CarbonPeriod {
        const from = start ?? this._start;

        if (!from) {
            throw new Error('Set a start date with start() or pass one to toPeriod().');
        }

        return CarbonPeriod.create({
            start: from,
            end: typeof end === 'number' ? undefined : (end ?? this._end),
            recurrences: typeof end === 'number' ? end : undefined,
            interval: this,
        });
    }

    toJSON(): string {
        return this.spec();
    }

    valueOf(): number {
        return this.total('millisecond');
    }
}

type PeriodFilter = (date: Carbon, key: number, period: CarbonPeriod) => boolean | typeof END_ITERATION;

type PeriodInit = {
    start?: DateInput;
    end?: DateInput;
    recurrences?: number;
    interval?: CarbonInterval | IntervalValues | string;
    excludeStart?: boolean;
    excludeEnd?: boolean;
};

/** Return this from a filter to stop the iteration instead of only skipping a date. */
const END_ITERATION = Symbol('CarbonPeriod.END_ITERATION');

/** Immutable series of dates between a start and an end (or a number of recurrences), one interval apart. */
class CarbonPeriod implements Iterable<Carbon> {
    static readonly END_ITERATION: typeof END_ITERATION = END_ITERATION;

    private readonly _start: Carbon;
    private readonly _end: Carbon | undefined;
    private readonly _recurrences: number | undefined;
    private readonly _interval: CarbonInterval;
    private readonly _excludeStart: boolean;
    private readonly _excludeEnd: boolean;
    private readonly _filters: {name?: string; filter: PeriodFilter}[];
    private _cache: Carbon[] | undefined;
    private _cursor = 0;

    constructor(init: PeriodInit & {filters?: {name?: string; filter: PeriodFilter}[]} = {}) {
        this._start = toCarbon(init.start ?? Carbon.now());
        this._end = init.end === undefined || init.end === null ? undefined : toCarbon(init.end);
        this._recurrences = init.recurrences;
        this._interval = CarbonInterval.make(init.interval ?? {days: 1});
        this._excludeStart = Boolean(init.excludeStart);
        this._excludeEnd = Boolean(init.excludeEnd);
        this._filters = init.filters ?? [];
    }

    // ----------------------------------------------------------------- creation

    static create(init: PeriodInit = {}): CarbonPeriod {
        return new CarbonPeriod(init);
    }

    static make(init: PeriodInit | CarbonPeriod): CarbonPeriod {
        return init instanceof CarbonPeriod ? init : new CarbonPeriod(init);
    }

    static instance(period: PeriodInit | CarbonPeriod): CarbonPeriod {
        return CarbonPeriod.make(period);
    }

    static cast(period: PeriodInit | CarbonPeriod): CarbonPeriod {
        return CarbonPeriod.make(period);
    }

    /** `[start, interval, end]` or `[start, interval, recurrences]`. */
    static createFromArray(parts: [DateInput, CarbonInterval | IntervalValues | string, DateInput | number]): CarbonPeriod {
        const [start, interval, end] = parts;
        return new CarbonPeriod({
            start,
            interval,
            end: typeof end === 'number' ? undefined : end,
            recurrences: typeof end === 'number' ? end : undefined,
        });
    }

    /** ISO 8601 repeating interval: `R5/2024-01-01T00:00:00Z/P1D` or `2024-01-01/P1D/2024-01-10`. */
    static createFromIso(iso: string): CarbonPeriod {
        const segments = iso.trim().split('/');
        const recurrence = segments[0]?.match(/^R(\d+)$/i);
        const [startText, intervalText, endText] = recurrence ? segments.slice(1) : segments;

        if (!startText || !intervalText) {
            throw new Error(`Invalid ISO 8601 specification: ${iso}.`);
        }

        return new CarbonPeriod({
            start: startText,
            interval: intervalText,
            end: endText,
            recurrences: recurrence ? Number(recurrence[1]) : undefined,
        });
    }

    static createFromISO8601String(iso: string): CarbonPeriod {
        return CarbonPeriod.createFromIso(iso);
    }

    private copyWith(init: PeriodInit & {filters?: {name?: string; filter: PeriodFilter}[]}): CarbonPeriod {
        return new CarbonPeriod({
            start: this._start,
            end: this._end,
            recurrences: this._recurrences,
            interval: this._interval,
            excludeStart: this._excludeStart,
            excludeEnd: this._excludeEnd,
            filters: this._filters,
            ...init,
        });
    }

    copy(): CarbonPeriod {
        return this.copyWith({});
    }

    clone(): CarbonPeriod {
        return this.copyWith({});
    }

    // ----------------------------------------------------------------- configuration

    getStartDate(): Carbon {
        return this._start;
    }

    getEndDate(): Carbon | undefined {
        return this._end;
    }

    getDateInterval(): CarbonInterval {
        return this._interval;
    }

    getRecurrences(): number | undefined {
        return this._recurrences;
    }

    getDateClass(): string {
        return 'Carbon';
    }

    getOptions(): {excludeStartDate: boolean; excludeEndDate: boolean} {
        return {excludeStartDate: this._excludeStart, excludeEndDate: this._excludeEnd};
    }

    setStartDate({date, inclusive = true}: {date: DateInput; inclusive?: boolean}): CarbonPeriod {
        return this.copyWith({start: date, excludeStart: !inclusive});
    }

    setEndDate({date, inclusive = true}: {date: DateInput; inclusive?: boolean}): CarbonPeriod {
        return this.copyWith({end: date, excludeEnd: !inclusive});
    }

    setDates({start, end}: {start: DateInput; end?: DateInput}): CarbonPeriod {
        return this.copyWith({start, end});
    }

    setDateInterval(interval: CarbonInterval | IntervalValues | string): CarbonPeriod {
        return this.copyWith({interval});
    }

    invertDateInterval(): CarbonPeriod {
        return this.copyWith({interval: this._interval.invert(), start: this._end ?? this._start, end: this._end ? this._start : undefined});
    }

    resetDateInterval(): CarbonPeriod {
        return this.copyWith({interval: {days: 1}});
    }

    setRecurrences(recurrences?: number): CarbonPeriod {
        return this.copyWith({recurrences});
    }

    setOptions(options: {excludeStartDate?: boolean; excludeEndDate?: boolean}): CarbonPeriod {
        return this.copyWith({excludeStart: Boolean(options.excludeStartDate), excludeEnd: Boolean(options.excludeEndDate)});
    }

    toggleOptions({options, state}: {options: ('excludeStartDate' | 'excludeEndDate')[]; state?: boolean}): CarbonPeriod {
        const current = this.getOptions();
        const next = {...current};
        options.forEach(option => {
            next[option] = state ?? !current[option];
        });
        return this.setOptions(next);
    }

    excludeStartDate(exclude = true): CarbonPeriod {
        return this.copyWith({excludeStart: exclude});
    }

    excludeEndDate(exclude = true): CarbonPeriod {
        return this.copyWith({excludeEnd: exclude});
    }

    isStartIncluded(): boolean {
        return !this._excludeStart;
    }

    isStartExcluded(): boolean {
        return this._excludeStart;
    }

    isEndIncluded(): boolean {
        return !this._excludeEnd;
    }

    isEndExcluded(): boolean {
        return this._excludeEnd;
    }

    // ----------------------------------------------------------------- filters

    /** A filter returns false to skip a date, or `CarbonPeriod.END_ITERATION` to stop. */
    addFilter({filter, name}: {filter: PeriodFilter; name?: string}): CarbonPeriod {
        return this.copyWith({filters: [...this._filters, {name, filter}]});
    }

    prependFilter({filter, name}: {filter: PeriodFilter; name?: string}): CarbonPeriod {
        return this.copyWith({filters: [{name, filter}, ...this._filters]});
    }

    removeFilter(filter: PeriodFilter | string): CarbonPeriod {
        return this.copyWith({filters: this._filters.filter(item => (typeof filter === 'string' ? item.name !== filter : item.filter !== filter))});
    }

    hasFilter(filter: PeriodFilter | string): boolean {
        return this._filters.some(item => (typeof filter === 'string' ? item.name === filter : item.filter === filter));
    }

    getFilters(): PeriodFilter[] {
        return this._filters.map(item => item.filter);
    }

    setFilters(filters: PeriodFilter[]): CarbonPeriod {
        return this.copyWith({filters: filters.map(filter => ({filter}))});
    }

    resetFilters(): CarbonPeriod {
        return this.copyWith({filters: []});
    }

    isUnfilteredAndEndLess(): boolean {
        return this._filters.length === 0 && this._end === undefined && this._recurrences === undefined;
    }

    // ----------------------------------------------------------------- iteration

    private step(date: Carbon): Carbon {
        const step = this._interval.getStep();
        return typeof step === 'function' ? step(date) : date.add(this._interval);
    }

    *[Symbol.iterator](): Generator<Carbon, void, undefined> {
        const limit = Carbon.getMaxIteration();
        const endless = this._end === undefined && this._recurrences === undefined && this._filters.length === 0;

        if (endless) {
            throw new Error('Cannot iterate a period without an end, recurrences or filters.');
        }

        const forward = !this._interval.isInverted() && !this._interval.hasNegativeValues();
        let date = this._start;
        let key = 0;
        let yielded = 0;

        for (let guard = 0; guard < limit * 100; guard++) {
            if (this._end) {
                const past = forward ? date.gt(this._end) : date.lt(this._end);
                const atEnd = date.eq(this._end);

                if (past || (atEnd && this._excludeEnd)) {
                    return;
                }
            }

            if (this._recurrences !== undefined && yielded >= this._recurrences) {
                return;
            }

            const skipped = key === 0 && this._excludeStart;
            let include = !skipped;

            for (const {filter} of this._filters) {
                const verdict = filter(date, key, this);

                if (verdict === END_ITERATION) {
                    return;
                }

                if (verdict === false) {
                    include = false;
                    break;
                }
            }

            if (include) {
                yield date;
                yielded++;
            }

            date = this.step(date);
            key++;
        }
    }

    getIterator(): Generator<Carbon, void, undefined> {
        return this[Symbol.iterator]();
    }

    toArray(): Carbon[] {
        return Array.from(this);
    }

    count(): number {
        return this.toArray().length;
    }

    first(): Carbon | undefined {
        for (const date of this) {
            return date;
        }

        return undefined;
    }

    last(): Carbon | undefined {
        const all = this.toArray();
        return all[all.length - 1];
    }

    /** Last date the period reaches (honours filters and exclusions). */
    calculateEnd(format?: string): Carbon | string | undefined {
        const last = this.last();
        return last && format ? last.format(format) : last;
    }

    forEach(callback: (date: Carbon, index: number) => void): void {
        this.toArray().forEach(callback);
    }

    map<R>(callback: (date: Carbon, index: number) => R): R[] {
        return this.toArray().map(callback);
    }

    // Stateful cursor, mirroring PHP's Iterator interface.

    rewind(): CarbonPeriod {
        this._cache = this.toArray();
        this._cursor = 0;
        return this;
    }

    valid(): boolean {
        this._cache ??= this.toArray();
        return this._cursor < this._cache.length;
    }

    current(): Carbon | undefined {
        this._cache ??= this.toArray();
        return this._cache[this._cursor];
    }

    key(): number | undefined {
        return this.valid() ? this._cursor : undefined;
    }

    next(): CarbonPeriod {
        this._cursor++;
        return this;
    }

    skip(count = 1): CarbonPeriod {
        this._cursor += count;
        return this;
    }

    // ----------------------------------------------------------------- queries

    getIncludedStartDate(): Carbon {
        return this._excludeStart ? this.step(this._start) : this._start;
    }

    getIncludedEndDate(): Carbon | undefined {
        if (!this._end) {
            return undefined;
        }

        return this._excludeEnd ? this._end.sub(this._interval) : this._end;
    }

    contains(date: DateInput): boolean {
        const target = toCarbon(date);
        const first = this.getIncludedStartDate();
        const last = this.getIncludedEndDate();
        return target.gte(first) && (!last || target.lte(last));
    }

    isStarted(): boolean {
        return Carbon.now().gte(this.getIncludedStartDate());
    }

    isEnded(): boolean {
        const last = this.getIncludedEndDate();
        return last !== undefined && Carbon.now().gt(last);
    }

    isInProgress(): boolean {
        return this.isStarted() && !this.isEnded();
    }

    startsAt(date: DateInput): boolean {
        return this.getIncludedStartDate().eq(date);
    }

    startsBefore(date: DateInput): boolean {
        return this.getIncludedStartDate().lt(date);
    }

    startsBeforeOrAt(date: DateInput): boolean {
        return this.getIncludedStartDate().lte(date);
    }

    startsAfter(date: DateInput): boolean {
        return this.getIncludedStartDate().gt(date);
    }

    startsAfterOrAt(date: DateInput): boolean {
        return this.getIncludedStartDate().gte(date);
    }

    endsAt(date: DateInput): boolean {
        return this.getIncludedEndDate()?.eq(date) ?? false;
    }

    endsBefore(date: DateInput): boolean {
        return this.getIncludedEndDate()?.lt(date) ?? false;
    }

    endsBeforeOrAt(date: DateInput): boolean {
        return this.getIncludedEndDate()?.lte(date) ?? false;
    }

    endsAfter(date: DateInput): boolean {
        return this.getIncludedEndDate()?.gt(date) ?? false;
    }

    endsAfterOrAt(date: DateInput): boolean {
        return this.getIncludedEndDate()?.gte(date) ?? false;
    }

    overlaps(other: CarbonPeriod): boolean {
        const aEnd = this.getIncludedEndDate();
        const bEnd = other.getIncludedEndDate();
        return (!bEnd || this.getIncludedStartDate().lte(bEnd)) && (!aEnd || other.getIncludedStartDate().lte(aEnd));
    }

    /** True when `other` starts right where this period stops. */
    follows(other: CarbonPeriod): boolean {
        const end = other.getIncludedEndDate();
        return end !== undefined && this.getIncludedStartDate().eq(end.add(other._interval));
    }

    isFollowedBy(other: CarbonPeriod): boolean {
        return other.follows(this);
    }

    isConsecutiveWith(other: CarbonPeriod): boolean {
        return this.follows(other) || this.isFollowedBy(other);
    }

    equalTo(other: CarbonPeriod): boolean {
        return this.toIso8601String() === other.toIso8601String();
    }

    eq(other: CarbonPeriod): boolean {
        return this.equalTo(other);
    }

    notEqualTo(other: CarbonPeriod): boolean {
        return !this.equalTo(other);
    }

    ne(other: CarbonPeriod): boolean {
        return this.notEqualTo(other);
    }

    // ----------------------------------------------------------------- rounding

    floorUnit({unit, precision = 1}: {unit: string; precision?: number}): CarbonPeriod {
        return this.copyWith({start: this._start.floorUnit({unit, precision}), end: this._end?.floorUnit({unit, precision})});
    }

    ceilUnit({unit, precision = 1}: {unit: string; precision?: number}): CarbonPeriod {
        return this.copyWith({start: this._start.ceilUnit({unit, precision}), end: this._end?.ceilUnit({unit, precision})});
    }

    roundUnit({unit, precision = 1}: {unit: string; precision?: number}): CarbonPeriod {
        return this.copyWith({start: this._start.roundUnit({unit, precision}), end: this._end?.roundUnit({unit, precision})});
    }

    floor(unit = 'second'): CarbonPeriod {
        return this.floorUnit({unit});
    }

    ceil(unit = 'second'): CarbonPeriod {
        return this.ceilUnit({unit});
    }

    round(unit = 'second'): CarbonPeriod {
        return this.roundUnit({unit});
    }

    // ----------------------------------------------------------------- output

    /** ISO 8601 text: `R5/start/P1D` for recurrences, `start/P1D/end` otherwise. */
    toIso8601String(): string {
        const start = this._start.toIso8601String();
        const interval = this._interval.spec();

        if (this._recurrences !== undefined) {
            return `R${this._recurrences}/${start}/${interval}`;
        }

        return this._end ? `${start}/${interval}/${this._end.toIso8601String()}` : `${start}/${interval}`;
    }

    spec(): string {
        return this.toIso8601String();
    }

    toString(): string {
        const interval = this._interval.forHumans();
        const from = `from ${this._start.toDateTimeString()}`;

        if (this._recurrences !== undefined) {
            return `${this._recurrences} time${this._recurrences === 1 ? '' : 's'} every ${interval} ${from}`;
        }

        return this._end ? `Every ${interval} ${from} to ${this._end.toDateTimeString()}` : `Every ${interval} ${from}`;
    }

    toJSON(): string {
        return this.toIso8601String();
    }
}

const COMMON_ZONES = [
    'UTC',
    'Africa/Cairo',
    'Africa/Johannesburg',
    'Africa/Lagos',
    'America/Anchorage',
    'America/Argentina/Buenos_Aires',
    'America/Chicago',
    'America/Denver',
    'America/Halifax',
    'America/Los_Angeles',
    'America/Mexico_City',
    'America/New_York',
    'America/Sao_Paulo',
    'America/Toronto',
    'Asia/Bangkok',
    'Asia/Dhaka',
    'Asia/Dubai',
    'Asia/Hong_Kong',
    'Asia/Jakarta',
    'Asia/Karachi',
    'Asia/Kolkata',
    'Asia/Kathmandu',
    'Asia/Seoul',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Asia/Tehran',
    'Asia/Tokyo',
    'Atlantic/Reykjavik',
    'Australia/Adelaide',
    'Australia/Perth',
    'Australia/Sydney',
    'Europe/Berlin',
    'Europe/Istanbul',
    'Europe/London',
    'Europe/Madrid',
    'Europe/Moscow',
    'Europe/Paris',
    'Pacific/Auckland',
    'Pacific/Honolulu',
];

/** A time zone: an IANA name ("Asia/Kolkata"), a fixed offset ("+05:30"), "UTC", or the device zone. */
class CarbonTimeZone {
    private readonly _name: TimeZoneName;

    constructor(name?: string | number | CarbonTimeZone | null) {
        this._name = name instanceof CarbonTimeZone ? name._name : normalizeTz(name);
    }

    static create(name?: string | number | CarbonTimeZone | null): CarbonTimeZone {
        return new CarbonTimeZone(name);
    }

    static instance(name?: string | number | CarbonTimeZone | null): CarbonTimeZone {
        return new CarbonTimeZone(name);
    }

    static cast(name?: string | number | CarbonTimeZone | null): CarbonTimeZone {
        return new CarbonTimeZone(name);
    }

    static createFromHourOffset(hours: number): CarbonTimeZone {
        return new CarbonTimeZone(hours);
    }

    static createFromMinuteOffset(minutes: number): CarbonTimeZone {
        return new CarbonTimeZone(minutes / 60);
    }

    static getOffsetNameFromMinuteOffset(minutes: number): string {
        return formatOffset({seconds: minutes * 60});
    }

    /** Region names known to the runtime; falls back to a short list of common zones. */
    static listIdentifiers(): string[] {
        const supported = (Intl as unknown as {supportedValuesOf?: (key: string) => string[]}).supportedValuesOf;
        return typeof supported === 'function' ? ['UTC', ...supported('timeZone').filter(name => name !== 'UTC')] : [...COMMON_ZONES];
    }

    static listAbbreviations(): Record<string, {offset: number; dst: boolean; timezone_id: string}[]> {
        const entries: Record<string, {offset: number; dst: boolean; timezone_id: string}[]> = {};
        const now = Date.now();

        COMMON_ZONES.forEach(timezone_id => {
            const abbr = tzAbbreviation({ms: now, tz: timezone_id}).toLowerCase();
            (entries[abbr] ??= []).push({offset: offsetAt({ms: now, tz: timezone_id}), dst: isDst({ms: now, tz: timezone_id}), timezone_id});
        });

        return entries;
    }

    getName(): string {
        return tzDisplayName(this._name);
    }

    toString(): string {
        return this.getName();
    }

    /** 1 = fixed offset, 3 = region name (PHP's constants). */
    getType(): 1 | 3 {
        return this._name !== undefined && fixedOffsetSeconds(this._name) !== undefined ? 1 : 3;
    }

    /** Seconds east of UTC at `date` (default now). */
    getOffset(date?: DateInput): number {
        const ms = toCarbon(date ?? Carbon.now()).valueOf();
        return offsetAt({ms, tz: this._name});
    }

    getAbbr(date?: DateInput): string {
        return tzAbbreviation({ms: toCarbon(date ?? Carbon.now()).valueOf(), tz: this._name});
    }

    getAbbreviatedName(date?: DateInput): string {
        return this.getAbbr(date);
    }

    getLocation(): {timezone: string} | false {
        return this.getType() === 3 ? {timezone: this.getName()} : false;
    }

    /** Offset changes (DST) between two dates, scanned day by day. Defaults to the current year. */
    getTransitions({from, to}: {from?: DateInput; to?: DateInput} = {}): {ts: number; time: string; offset: number; isdst: boolean; abbr: string}[] {
        const start = toCarbon(from ?? Carbon.now().startOfYear());
        const end = toCarbon(to ?? Carbon.now().endOfYear());
        const result: {ts: number; time: string; offset: number; isdst: boolean; abbr: string}[] = [];
        let previous = offsetAt({ms: start.valueOf(), tz: this._name});

        for (let ms = start.valueOf() + DAY; ms <= end.valueOf(); ms += DAY) {
            const offset = offsetAt({ms, tz: this._name});

            if (offset !== previous) {
                let low = ms - DAY;
                let high = ms;

                while (high - low > 1000) {
                    const middle = Math.floor((low + high) / 2);

                    if (offsetAt({ms: middle, tz: this._name}) === previous) {
                        low = middle;
                    } else {
                        high = middle;
                    }
                }

                result.push({
                    ts: Math.floor(high / 1000),
                    time: new Date(high).toISOString(),
                    offset,
                    isdst: isDst({ms: high, tz: this._name}),
                    abbr: tzAbbreviation({ms: high, tz: this._name}),
                });
                previous = offset;
            }
        }

        return result;
    }

    /** "+05:30" for the offset at `date`. */
    toOffsetName(date?: DateInput): string {
        return formatOffset({seconds: this.getOffset(date)});
    }

    toOffsetTimeZone(date?: DateInput): CarbonTimeZone {
        return new CarbonTimeZone(this.toOffsetName(date));
    }

    /** A region name with the same offset at `date`; returns this zone's name when it already is one. */
    toRegionName(date?: DateInput): string | null {
        if (this.getType() === 3) {
            return this.getName();
        }

        const ms = toCarbon(date ?? Carbon.now()).valueOf();
        const offset = this.getOffset(date);
        const dst = isDst({ms, tz: this._name});

        return CarbonTimeZone.listIdentifiers().find(name => offsetAt({ms, tz: name}) === offset && isDst({ms, tz: name}) === dst) ?? null;
    }

    toRegionTimeZone(date?: DateInput): CarbonTimeZone | null {
        const name = this.toRegionName(date);
        return name ? new CarbonTimeZone(name) : null;
    }
}

class DateUtils {
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

        return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => map[match] ?? '');
    }

    /**
     * Formats a date using the Intl.DateTimeFormat API.
     * @param param0 - An object containing the date, locale, and formatting options.
     * @returns A formatted date string.
     */
    static format({
        date,
        locale = 'default',
        options = {dateStyle: 'long', timeStyle: 'medium'},
    }: {
        date: Date | string;
        locale?: string;
        options?: Intl.DateTimeFormatOptions;
    }): string {
        const d = typeof date === 'string' ? new Date(date) : date;
        return new Intl.DateTimeFormat(locale, options).format(d);
    }

    /**
     * Returns the difference between two dates in the specified unit.
     * Supported units: days, hours, minutes, seconds
     */
    static getDateDifference(date1: Date | string, date2: Date | string, unit: 'days' | 'hours' | 'minutes' | 'seconds' = 'days'): number {
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
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
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

        const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

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
        if (d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()) {
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

    /**
     * Entry points to the Carbon-style API. Every date they return is immutable and chainable:
     * `DateUtils.now().addDays(3).startOfDay().format('Y-m-d')`.
     */
    static now(tz?: TzInput): Carbon {
        return Carbon.now(tz);
    }

    static today(tz?: TzInput): Carbon {
        return Carbon.today(tz);
    }

    static tomorrow(tz?: TzInput): Carbon {
        return Carbon.tomorrow(tz);
    }

    static yesterday(tz?: TzInput): Carbon {
        return Carbon.yesterday(tz);
    }

    static parse(time?: DateInput | {time?: DateInput; tz?: TzInput}): Carbon {
        return Carbon.parse(time);
    }

    static create(
        parts: {
            year?: number;
            month?: number;
            day?: number;
            hour?: number;
            minute?: number;
            second?: number;
            millisecond?: number;
            tz?: TzInput;
        } = {},
    ): Carbon {
        return Carbon.create(parts);
    }

    static createFromFormat({format, time, tz}: {format: string; time: string; tz?: TzInput}): Carbon {
        return Carbon.createFromFormat({format, time, tz});
    }

    static createFromIsoFormat({format, time, tz}: {format: string; time: string; tz?: TzInput}): Carbon {
        return Carbon.createFromIsoFormat({format, time, tz});
    }

    static createFromTimestamp(timestamp: number | {timestamp: number; tz?: TzInput}): Carbon {
        return Carbon.createFromTimestamp(timestamp);
    }

    static interval(value: CarbonInterval | IntervalValues | string): CarbonInterval {
        return CarbonInterval.make(value);
    }

    static period(init: ConstructorParameters<typeof CarbonPeriod>[0] = {}): CarbonPeriod {
        return CarbonPeriod.create(init);
    }

    static timezone(name?: string | number | CarbonTimeZone | null): CarbonTimeZone {
        return CarbonTimeZone.create(name);
    }

    /** Freeze "now" for tests: `DateUtils.setTestNow('2024-03-05 10:00')`, and call without arguments to unfreeze. */
    static setTestNow(date?: DateInput): void {
        Carbon.setTestNow(date);
    }

    static withTestNow<R>({testNow, callback}: {testNow?: DateInput; callback: () => R}): R {
        return Carbon.withTestNow({testNow, callback});
    }
}

export {Carbon, CarbonInterval, CarbonPeriod, CarbonTimeZone};
export type {DateInput, HumanOptions, IntervalValues, PeriodFilter, TzInput};
export default DateUtils;
