type Digits = {precision?: number; maxPrecision?: number};

const ONES = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];
const IRREGULAR_ORDINALS: Record<string, string> = {
    one: 'first',
    two: 'second',
    three: 'third',
    five: 'fifth',
    eight: 'eighth',
    nine: 'ninth',
    twelve: 'twelfth',
};

const ABBREVIATIONS = ['', 'K', 'M', 'B', 'T', 'Q'];
const HUMAN_UNITS = ['', ' thousand', ' million', ' billion', ' trillion', ' quadrillion'];
const FILE_UNITS = [' B', ' KB', ' MB', ' GB', ' TB', ' PB', ' EB', ' ZB', ' YB'];

let currentLocale = 'en';
let currentCurrency = 'USD';

/**
 * Formats with at least `precision` and at most `maxPrecision` fraction digits. Like Laravel,
 * `precision` alone fixes the digit count and `maxPrecision` alone only caps it.
 */
const formatNumber = ({number, precision, maxPrecision, locale}: Digits & {number: number; locale?: string}) => {
    const minimumFractionDigits = precision ?? 0;
    const maximumFractionDigits = Math.max(minimumFractionDigits, maxPrecision ?? precision ?? 0);

    return new Intl.NumberFormat(locale ?? currentLocale, {minimumFractionDigits, maximumFractionDigits}).format(number);
};

/**
 * Divides `number` by `base` until it fits the largest unit that keeps it under `base`, then formats it.
 * Rounding can push a value back up to `base` (999,999 -> 1,000K), so it is rescaled once more.
 */
const scale = ({number, base, units, precision, maxPrecision}: Digits & {number: number; base: number; units: string[]}) => {
    const digits = Math.max(precision ?? 0, maxPrecision ?? precision ?? 0);
    let value = number;
    let index = 0;

    while (Math.abs(value) >= base && index < units.length - 1) {
        value /= base;
        index++;
    }

    if (Math.abs(Number(value.toFixed(digits))) >= base && index < units.length - 1) {
        value /= base;
        index++;
    }

    return `${formatNumber({number: value, precision, maxPrecision})}${units[index]}`;
};

const spellBelowThousand = (number: number) => {
    const hundreds = Math.floor(number / 100);
    const rest = number % 100;
    const restWords = rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ''}`;

    if (!hundreds) {
        return restWords as string;
    }

    const hundredsWords = `${ONES[hundreds]} hundred`;
    return rest ? `${hundredsWords} and ${restWords}` : hundredsWords;
};

const spellInteger = (number: number) => {
    if (number === 0) {
        return ONES[0] as string;
    }

    const groups: string[] = [];
    let remaining = number;
    let scaleIndex = 0;

    while (remaining > 0) {
        const chunk = remaining % 1000;

        if (chunk) {
            const joinAnd = scaleIndex === 0 && chunk < 100 && number >= 1000;
            const words = spellBelowThousand(chunk);
            groups.unshift(`${joinAnd ? 'and ' : ''}${words}${SCALES[scaleIndex] ? ` ${SCALES[scaleIndex]}` : ''}`);
        }

        remaining = Math.floor(remaining / 1000);
        scaleIndex++;
    }

    return groups.join(' ');
};

const assertSpellable = (number: number) => {
    if (!Number.isFinite(number) || Math.abs(number) >= 1e18 || String(number).includes('e')) {
        throw new RangeError(`Cannot spell ${number}.`);
    }
};

/**
 * Port of Laravel's `Number` helper. Formatting runs on `Intl.NumberFormat`, so it follows the
 * locale and currency set with `useLocale` / `useCurrency`. `spell`, `spellOrdinal` and `ordinal`
 * are English only, because JavaScript has no built-in spell-out support.
 */
class NumberUtils {
    /** Locale used by every method that does not receive one. */
    static defaultLocale(): string {
        return currentLocale;
    }

    static defaultCurrency(): string {
        return currentCurrency;
    }

    static useLocale(locale: string): void {
        currentLocale = locale;
    }

    static useCurrency(currency: string): void {
        currentCurrency = currency;
    }

    /** Run `callback` with another default locale and restore the previous one afterwards (sync only). */
    static withLocale<R>({locale, callback}: {locale: string; callback: () => R}): R {
        const previous = currentLocale;
        currentLocale = locale;

        try {
            return callback();
        } finally {
            currentLocale = previous;
        }
    }

    static withCurrency<R>({currency, callback}: {currency: string; callback: () => R}): R {
        const previous = currentCurrency;
        currentCurrency = currency;

        try {
            return callback();
        } finally {
            currentCurrency = previous;
        }
    }

    static format({number, precision, maxPrecision, locale}: Digits & {number: number; locale?: string}): string {
        return formatNumber({number, precision, maxPrecision, locale});
    }

    /** Formats `number` followed by `%`; it does not multiply, so `10` becomes "10%". */
    static percentage({number, precision, maxPrecision, locale}: Digits & {number: number; locale?: string}): string {
        return `${formatNumber({number, precision, maxPrecision, locale})}%`;
    }

    /** `in` is the currency code and defaults to `defaultCurrency()`. */
    static currency({number, in: currency, locale, precision}: {number: number; in?: string; locale?: string; precision?: number}): string {
        return new Intl.NumberFormat(locale ?? currentLocale, {
            style: 'currency',
            currency: currency ?? currentCurrency,
            ...(precision === undefined ? {} : {minimumFractionDigits: precision, maximumFractionDigits: precision}),
        }).format(number);
    }

    /** 1230000 -> "1.23M" with `precision: 2`. */
    static abbreviate({number, precision, maxPrecision}: Digits & {number: number}): string {
        return scale({number, base: 1000, units: ABBREVIATIONS, precision, maxPrecision});
    }

    /** 1230000 -> "1.23 million" with `precision: 2`, or "1.23M" with `abbreviate: true`. */
    static forHumans({number, precision, maxPrecision, abbreviate = false}: Digits & {number: number; abbreviate?: boolean}): string {
        return scale({number, base: 1000, units: abbreviate ? ABBREVIATIONS : HUMAN_UNITS, precision, maxPrecision});
    }

    /** Binary units: 1024 -> "1 KB". */
    static fileSize({bytes, precision, maxPrecision}: Digits & {bytes: number}): string {
        return scale({number: bytes, base: 1024, units: FILE_UNITS, precision, maxPrecision});
    }

    static clamp({number, min, max}: {number: number; min: number; max: number}): number {
        return Math.min(Math.max(number, min), max);
    }

    /**
     * Split `0..to` into ranges of `by`. `offset` is subtracted from each upper bound, so the default
     * of 1 gives non-overlapping ranges ([0, 9], [10, 19]) and 0 gives shared edges ([0, 10], [10, 20]).
     */
    static pairs({to, by, offset = 1}: {to: number; by: number; offset?: number}): [number, number][] {
        const result: [number, number][] = [];

        for (let lower = 0; lower < to; lower += by) {
            result.push([lower, Math.min(lower + by - offset, to)]);
        }

        return result;
    }

    /** Drop trailing zeros: "12.30" -> 12.3. Returns `NaN` for text that is not a number. */
    static trim(number: number | string): number {
        return Number(number);
    }

    /** Read a locale-formatted number ("1.234,5" in `de`). Returns `null` when the text is not a number. */
    static parse({string, locale}: {string: string; locale?: string}): number | null {
        const parts = new Intl.NumberFormat(locale ?? currentLocale).formatToParts(-12345.6);
        const group = parts.find(part => part.type === 'group')?.value;
        const decimal = parts.find(part => part.type === 'decimal')?.value ?? '.';

        let cleaned = string.trim().replace(/−/g, '-');
        cleaned = group ? cleaned.split(group).join('') : cleaned;
        cleaned = cleaned.replace(/[\s  ]/g, '').replace(decimal, '.');

        return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : null;
    }

    static parseInt({string, locale}: {string: string; locale?: string}): number | null {
        const value = NumberUtils.parse({string, locale});
        return value === null ? null : Math.trunc(value);
    }

    static parseFloat({string, locale}: {string: string; locale?: string}): number | null {
        return NumberUtils.parse({string, locale});
    }

    /** 21 -> "21st". English only. */
    static ordinal(number: number): string {
        const lastTwo = Math.abs(number) % 100;
        const suffix = lastTwo >= 11 && lastTwo <= 13 ? 'th' : (({1: 'st', 2: 'nd', 3: 'rd'} as Record<number, string>)[lastTwo % 10] ?? 'th');
        return `${number}${suffix}`;
    }

    /**
     * 102 -> "one hundred and two". English only. `after` spells only numbers above it and `until`
     * only numbers below it; anything else is returned as formatted digits.
     */
    static spell({number, after, until}: {number: number; after?: number; until?: number}): string {
        if ((after !== undefined && number <= after) || (until !== undefined && number >= until)) {
            return formatNumber({number, maxPrecision: 20});
        }

        assertSpellable(number);

        const [whole = '', fraction] = String(Math.abs(number)).split('.');
        const words = spellInteger(Number(whole));
        const decimals = fraction ? ` point ${[...fraction].map(digit => ONES[Number(digit)]).join(' ')}` : '';

        return `${number < 0 ? 'minus ' : ''}${words}${decimals}`;
    }

    /** 21 -> "twenty-first". English only, whole numbers only. */
    static spellOrdinal(number: number): string {
        if (!Number.isInteger(number)) {
            throw new RangeError(`Cannot spell an ordinal for ${number}.`);
        }

        assertSpellable(number);

        const words = `${number < 0 ? 'minus ' : ''}${spellInteger(Math.abs(number))}`;
        const [, head = '', last = ''] = words.match(/^(.*[\s-])?([a-z]+)$/) ?? [];
        const ordinal = IRREGULAR_ORDINALS[last] ?? (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`);

        return `${head}${ordinal}`;
    }
}

export default NumberUtils;
