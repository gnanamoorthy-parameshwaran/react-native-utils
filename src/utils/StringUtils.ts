type Needles = string | string[];
type InflectionRule = [RegExp, string];

const list = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toChars = (value: string) => Array.from(value);
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * PHP-style `substr` that counts code points: a negative `start` counts from the end and a
 * negative `length` stops that many characters before the end.
 */
const substr = ({string, start, length}: {string: string; start: number; length?: number}) => {
    const chars = toChars(string);
    const from = start < 0 ? Math.max(0, chars.length + start) : Math.min(start, chars.length);
    const to = length === undefined ? chars.length : length < 0 ? chars.length + length : from + length;

    return chars.slice(from, to).join('');
};

const TRANSLITERATIONS: Record<string, string> = {
    'ß': 'ss',
    'æ': 'ae',
    'Æ': 'AE',
    'œ': 'oe',
    'Œ': 'OE',
    'ø': 'o',
    'Ø': 'O',
    'đ': 'd',
    'Đ': 'D',
    'ð': 'd',
    'Ð': 'D',
    'þ': 'th',
    'Þ': 'TH',
    'ł': 'l',
    'Ł': 'L',
    'ı': 'i',
    '‘': "'",
    '’': "'",
    '“': '"',
    '”': '"',
    '–': '-',
    '—': '-',
    '…': '...',
};

/** Strips accents and maps common Latin letters; `onUnknown` decides what happens to anything else non-ASCII. */
const toAscii = ({value, onUnknown}: {value: string; onUnknown: (char: string) => string}) =>
    toChars(value)
        .map(char => {
            if (char.charCodeAt(0) < 128) {
                return char;
            }

            const mapped = TRANSLITERATIONS[char] ?? char.normalize('NFD').replace(/[̀-ͯ]/g, '');
            return /^[\x00-\x7F]*$/.test(mapped) ? mapped : onUnknown(char);
        })
        .join('');

const UNCOUNTABLE = new Set([
    'audio',
    'bison',
    'chassis',
    'compensation',
    'coreopsis',
    'data',
    'deer',
    'education',
    'emoji',
    'equipment',
    'evidence',
    'feedback',
    'firmware',
    'fish',
    'furniture',
    'gold',
    'hardware',
    'information',
    'jedi',
    'kin',
    'knowledge',
    'love',
    'metadata',
    'money',
    'moose',
    'news',
    'nutrition',
    'offspring',
    'plankton',
    'pokemon',
    'police',
    'rain',
    'recommended',
    'related',
    'rice',
    'series',
    'sheep',
    'software',
    'species',
    'swine',
    'traffic',
    'wheat',
]);

const IRREGULAR_PLURALS: Record<string, string> = {
    person: 'people',
    man: 'men',
    woman: 'women',
    child: 'children',
    foot: 'feet',
    tooth: 'teeth',
    goose: 'geese',
    mouse: 'mice',
    ox: 'oxen',
    die: 'dice',
    leaf: 'leaves',
    knife: 'knives',
    life: 'lives',
    wife: 'wives',
    wolf: 'wolves',
    half: 'halves',
    self: 'selves',
    move: 'moves',
    sex: 'sexes',
    zombie: 'zombies',
};
const IRREGULAR_SINGULARS = Object.fromEntries(Object.entries(IRREGULAR_PLURALS).map(([singular, plural]) => [plural, singular]));

const PLURAL_RULES: InflectionRule[] = [
    [/(quiz)$/, '$1zes'],
    [/(matr|vert|ind)(ix|ex)$/, '$1ices'],
    [/(x|ch|ss|sh)$/, '$1es'],
    [/([^aeiouy]|qu)y$/, '$1ies'],
    [/(hive)$/, '$1s'],
    [/(?:([^f])fe|([lr])f)$/, '$1$2ves'],
    [/sis$/, 'ses'],
    [/([ti])um$/, '$1a'],
    [/(buffal|tomat|potat|her)o$/, '$1oes'],
    [/(bu)s$/, '$1ses'],
    [/(alias|status)$/, '$1es'],
    [/(octop|vir)us$/, '$1i'],
    [/(ax|test)is$/, '$1es'],
    [/s$/, 's'],
    [/$/, 's'],
];

const SINGULAR_RULES: InflectionRule[] = [
    [/(quiz)zes$/, '$1'],
    [/(matr)ices$/, '$1ix'],
    [/(vert|ind)ices$/, '$1ex'],
    [/(alias|status)(es)?$/, '$1'],
    [/(octop|vir)(us|i)$/, '$1us'],
    [/(cris|ax|test)(is|es)$/, '$1is'],
    [/(shoe)s$/, '$1'],
    [/(o)es$/, '$1'],
    [/(bus)(es)?$/, '$1'],
    [/([ml])ice$/, '$1ouse'],
    [/(x|ch|ss|sh)es$/, '$1'],
    [/(m)ovies$/, '$1ovie'],
    [/([^aeiouy]|qu)ies$/, '$1y'],
    [/([lr])ves$/, '$1f'],
    [/(tive)s$/, '$1'],
    [/(hive)s$/, '$1'],
    [/([^f])ves$/, '$1fe'],
    [/(^analy)(sis|ses)$/, '$1sis'],
    [/((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)(sis|ses)$/, '$1sis'],
    [/([ti])a$/, '$1um'],
    [/(ss|us|is)$/, '$1'],
    [/s$/, ''],
];

const matchCase = ({original, result}: {original: string; result: string}) => {
    if (original.length > 1 && original === original.toUpperCase()) {
        return result.toUpperCase();
    }

    return original.charAt(0) !== original.charAt(0).toLowerCase() ? capitalize(result) : result;
};

/** Inflects only the last word of `value`, keeping its original capitalisation. */
const inflect = ({
    value,
    rules,
    irregular,
    alreadyDone,
}: {
    value: string;
    rules: InflectionRule[];
    irregular: Record<string, string>;
    alreadyDone: Record<string, string>;
}) => {
    const [, prefix = '', word = ''] = value.match(/^(.*?)([A-Za-z]+)$/) ?? [];
    const lower = word.toLowerCase();

    if (!word || UNCOUNTABLE.has(lower) || lower in alreadyDone) {
        return value;
    }

    const irregularForm = irregular[lower];

    if (irregularForm !== undefined) {
        return prefix + matchCase({original: word, result: irregularForm});
    }

    const rule = rules.find(([pattern]) => pattern.test(lower));
    return rule ? prefix + matchCase({original: word, result: lower.replace(rule[0], rule[1])}) : value;
};

const APA_MINOR_WORDS = new Set([
    'a',
    'an',
    'and',
    'as',
    'at',
    'but',
    'by',
    'for',
    'if',
    'in',
    'nor',
    'of',
    'off',
    'on',
    'or',
    'per',
    'so',
    'the',
    'to',
    'up',
    'via',
    'yet',
]);

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Secure random bytes. React Native has no `crypto` global by default, so this fails loudly rather
 * than falling back to `Math.random`, which is unsafe for tokens and passwords.
 */
const randomBytes = (length: number) => {
    const crypto = (globalThis as any).crypto;

    if (!crypto?.getRandomValues) {
        throw new Error('No secure random source found. Import "react-native-get-random-values" before using this method.');
    }

    return crypto.getRandomValues(new Uint8Array(length)) as Uint8Array;
};

/** Rejection sampling keeps every character of `alphabet` equally likely. */
const randomFrom = ({alphabet, length}: {alphabet: string[]; length: number}) => {
    const limit = 256 - (256 % alphabet.length);
    const result: string[] = [];

    while (result.length < length) {
        for (const byte of randomBytes(length * 2)) {
            if (byte < limit && result.length < length) {
                result.push(alphabet[byte % alphabet.length] as string);
            }
        }
    }

    return result.join('');
};

const formatUuid = (bytes: Uint8Array) => {
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const trimPattern = ({chars, side}: {chars?: string; side: 'left' | 'right' | 'both'}) => {
    const set = chars === undefined ? '[\\s\\0]' : `[${chars.replace(/[\\\][^-]/g, '\\$&')}]`;
    const parts = [side !== 'right' && `^${set}+`, side !== 'left' && `${set}+$`].filter(Boolean);

    return new RegExp(parts.join('|'), 'gu');
};

/**
 * Port of Laravel's `Str` helpers, added to the existing string utilities. Methods count characters as
 * code points, never mutate input, and return `null` where Laravel returns `false`. Left out because
 * they depend on PHP or Laravel itself: `markdown`, `inlineMarkdown`, `class_basename`, `trans`,
 * `trans_choice`, `__` and the fluent `str()`. `length` is `lengthOf` because a static `length` clashes
 * with `Function.length`.
 */
class StringUtils {
    // Convert string to title case
    static toTitleCase(str: string): string {
        if (!str) return '';
        return str.replace(/\w\S*/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    }

    // Check if a string is a palindrome
    static isPalindrome(str: string): boolean {
        if (!str) return false;
        const cleaned = str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return cleaned === cleaned.split('').reverse().join('');
    }

    // Truncate string to a specific length and append ellipsis
    static truncate(str: string, maxLength: number, ellipsis: string = '...'): string {
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
        const spacedString = input.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

        // Capitalize the first letter of the entire string
        return spacedString.charAt(0).toUpperCase() + spacedString.slice(1) + '.';
    }

    static generateUUID = (): string => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
            const random = (Math.random() * 16) | 0; // Generate a random number between 0 and 15
            const value = char === 'x' ? random : (random & 0x3) | 0x8; // Apply variant bit for 'y'
            return value.toString(16); // Convert to hexadecimal
        });
    };

    static after({subject, search}: {subject: string; search: string}): string {
        const index = search === '' ? -1 : subject.indexOf(search);
        return index === -1 ? subject : subject.slice(index + search.length);
    }

    static afterLast({subject, search}: {subject: string; search: string}): string {
        const index = search === '' ? -1 : subject.lastIndexOf(search);
        return index === -1 ? subject : subject.slice(index + search.length);
    }

    static before({subject, search}: {subject: string; search: string}): string {
        const index = search === '' ? -1 : subject.indexOf(search);
        return index === -1 ? subject : subject.slice(0, index);
    }

    static beforeLast({subject, search}: {subject: string; search: string}): string {
        const index = search === '' ? -1 : subject.lastIndexOf(search);
        return index === -1 ? subject : subject.slice(0, index);
    }

    /** Text after the first `from` and before the last `to`. */
    static between({subject, from, to}: {subject: string; from: string; to: string}): string {
        if (from === '' || to === '') {
            return subject;
        }

        return StringUtils.beforeLast({subject: StringUtils.after({subject, search: from}), search: to});
    }

    /** Text after the first `from` and before the next `to`. */
    static betweenFirst({subject, from, to}: {subject: string; from: string; to: string}): string {
        if (from === '' || to === '') {
            return subject;
        }

        return StringUtils.before({subject: StringUtils.after({subject, search: from}), search: to});
    }

    static studly(value: string): string {
        return value
            .split(/[\s_-]+/)
            .map(capitalize)
            .join('');
    }

    static camel(value: string): string {
        return StringUtils.lcfirst(StringUtils.studly(value));
    }

    static snake({value, delimiter = '_'}: {value: string; delimiter?: string}): string {
        if (value === value.toLowerCase()) {
            return value;
        }

        return StringUtils.ucwords({value})
            .replace(/\s+/gu, '')
            .replace(/(.)(?=\p{Lu})/gu, `$1${delimiter}`)
            .toLowerCase();
    }

    static kebab(value: string): string {
        return StringUtils.snake({value, delimiter: '-'});
    }

    /** "EmailNotificationSent" or "email_notification_sent" -> "Email Notification Sent". */
    static headline(value: string): string {
        return value
            .split(/[\s_-]+/)
            .flatMap(StringUtils.ucsplit)
            .filter(Boolean)
            .map(capitalize)
            .join(' ');
    }

    /** Title case that lowercases the rest of each word. */
    static title(value: string): string {
        return value.toLowerCase().replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_, boundary: string, letter: string) => boundary + letter.toUpperCase());
    }

    /** APA-style title case: short joining words stay lowercase unless first, last or after a colon. */
    static apa(value: string): string {
        const words = value.split(' ');

        return words
            .map((word, index) => {
                const lower = word.toLowerCase();
                const afterColon = index > 0 && (words[index - 1] ?? '').endsWith(':');

                if (/[A-Z]/.test(word.slice(1))) {
                    return word;
                }

                if (word.includes('-')) {
                    return word.split('-').map(capitalize).join('-');
                }

                const stayLower = APA_MINOR_WORDS.has(lower) && index !== 0 && index !== words.length - 1 && !afterColon;
                return stayLower ? lower : capitalize(lower);
            })
            .join(' ');
    }

    static ucfirst(value: string): string {
        return capitalize(value);
    }

    static lcfirst(value: string): string {
        return value.charAt(0).toLowerCase() + value.slice(1);
    }

    /** Capitalise the first letter and any letter after one of `delimiters`. Other letters are untouched. */
    static ucwords({value, delimiters = ' \t\r\n\f\v'}: {value: string; delimiters?: string}): string {
        let upper = true;

        return toChars(value)
            .map(char => {
                const result = upper ? char.toUpperCase() : char;
                upper = delimiters.includes(char);
                return result;
            })
            .join('');
    }

    /** Split before each uppercase letter: "FooBar" -> ["Foo", "Bar"]. */
    static ucsplit(value: string): string[] {
        return value.split(/(?=\p{Lu})/u).filter(Boolean);
    }

    static lower(value: string): string {
        return value.toLowerCase();
    }

    static upper(value: string): string {
        return value.toUpperCase();
    }

    static lengthOf(value: string): number {
        return toChars(value).length;
    }

    static charAt({subject, index}: {subject: string; index: number}): string | null {
        const chars = toChars(subject);
        return chars[index < 0 ? chars.length + index : index] ?? null;
    }

    static initials(name: string): string {
        return name
            .split(/\s+/)
            .filter(Boolean)
            .map(word => toChars(word)[0]?.toUpperCase() ?? '')
            .join('');
    }

    static chopStart({subject, needle}: {subject: string; needle: Needles}): string {
        const found = list(needle).find(item => item !== '' && subject.startsWith(item));
        return found === undefined ? subject : subject.slice(found.length);
    }

    static chopEnd({subject, needle}: {subject: string; needle: Needles}): string {
        const found = list(needle).find(item => item !== '' && subject.endsWith(item));
        return found === undefined ? subject : subject.slice(0, subject.length - found.length);
    }

    static contains({haystack, needles, ignoreCase = false}: {haystack: string; needles: Needles; ignoreCase?: boolean}): boolean {
        const subject = ignoreCase ? haystack.toLowerCase() : haystack;
        return list(needles).some(needle => needle !== '' && subject.includes(ignoreCase ? needle.toLowerCase() : needle));
    }

    static containsAll({haystack, needles, ignoreCase = false}: {haystack: string; needles: string[]; ignoreCase?: boolean}): boolean {
        return needles.every(needle => StringUtils.contains({haystack, needles: needle, ignoreCase}));
    }

    static doesntContain({haystack, needles, ignoreCase = false}: {haystack: string; needles: Needles; ignoreCase?: boolean}): boolean {
        return !StringUtils.contains({haystack, needles, ignoreCase});
    }

    static startsWith({haystack, needles}: {haystack: string; needles: Needles}): boolean {
        return list(needles).some(needle => needle !== '' && haystack.startsWith(needle));
    }

    static doesntStartWith({haystack, needles}: {haystack: string; needles: Needles}): boolean {
        return !StringUtils.startsWith({haystack, needles});
    }

    static endsWith({haystack, needles}: {haystack: string; needles: Needles}): boolean {
        return list(needles).some(needle => needle !== '' && haystack.endsWith(needle));
    }

    static doesntEndWith({haystack, needles}: {haystack: string; needles: Needles}): boolean {
        return !StringUtils.endsWith({haystack, needles});
    }

    /** Collapse runs of `character` into one: "a  b" -> "a b". */
    static deduplicate({string, character = ' '}: {string: string; character?: Needles}): string {
        return list(character).reduce(
            (result, item) => (item === '' ? result : result.replace(new RegExp(`(${escapeRegExp(item)})+`, 'g'), item)),
            string,
        );
    }

    /** Add `cap` to the end once, however many copies were already there. */
    static finish({value, cap}: {value: string; cap: string}): string {
        return cap === '' ? value : value.replace(new RegExp(`(?:${escapeRegExp(cap)})+$`), '') + cap;
    }

    static start({value, prefix}: {value: string; prefix: string}): string {
        return prefix === '' ? value : prefix + value.replace(new RegExp(`^(?:${escapeRegExp(prefix)})+`), '');
    }

    static wrap({value, before, after}: {value: string; before: string; after?: string}): string {
        return before + value + (after ?? before);
    }

    static unwrap({value, before, after}: {value: string; before: string; after?: string}): string {
        const closing = after ?? before;
        const start = value.startsWith(before) ? value.slice(before.length) : value;
        return start.endsWith(closing) ? start.slice(0, start.length - closing.length) : start;
    }

    /** Snippet of `radius` characters either side of the first `phrase` match, or `null` without one. */
    static excerpt({
        text,
        phrase,
        radius = 100,
        omission = '...',
    }: {
        text: string;
        phrase: string;
        radius?: number;
        omission?: string;
    }): string | null {
        const index = text.toLowerCase().indexOf(phrase.toLowerCase());

        if (index === -1) {
            return null;
        }

        const before = text.slice(0, index).trimStart();
        const after = text.slice(index + phrase.length).trimEnd();
        const head = before.slice(-radius).trimStart();
        const tail = after.slice(0, radius).trimEnd();

        return `${head === before ? '' : omission}${head}${text.slice(index, index + phrase.length)}${tail}${tail === after ? '' : omission}`;
    }

    static limit({
        value,
        limit = 100,
        end = '...',
        preserveWords = false,
    }: {
        value: string;
        limit?: number;
        end?: string;
        preserveWords?: boolean;
    }): string {
        if (StringUtils.lengthOf(value) <= limit) {
            return value;
        }

        const trimmed = substr({string: value, start: 0, length: limit}).trimEnd();

        const atBoundary =
            /\s/.test(substr({string: value, start: limit, length: 1})) || /\s$/.test(substr({string: value, start: 0, length: limit}));

        if (!preserveWords || atBoundary) {
            return trimmed + end;
        }

        return trimmed.replace(/(.*)\s.*/, '$1') + end;
    }

    static words({value, words = 100, end = '...'}: {value: string; words?: number; end?: string}): string {
        const matched = value.match(new RegExp(`^\\s*(?:\\S+\\s*){1,${words}}`, 'u'));
        return !matched || matched[0].length === value.length ? value : matched[0].trimEnd() + end;
    }

    static wordCount(value: string): number {
        return (value.match(/[\p{L}'-]+/gu) ?? []).length;
    }

    /** Greedy word wrap at `characters` columns, like PHP's `wordwrap`. */
    static wordWrap({
        string,
        characters = 75,
        breakStr = '\n',
        cutLongWords = false,
    }: {
        string: string;
        characters?: number;
        breakStr?: string;
        cutLongWords?: boolean;
    }): string {
        return string
            .split(breakStr)
            .map(line => {
                const lines: string[] = [];
                let current = '';

                line.split(' ').forEach(word => {
                    let rest = word;

                    while (cutLongWords && rest.length > characters) {
                        if (current !== '') {
                            lines.push(current);
                            current = '';
                        }

                        lines.push(rest.slice(0, characters));
                        rest = rest.slice(characters);
                    }

                    if (current === '') {
                        current = rest;
                    } else if (`${current} ${rest}`.length <= characters) {
                        current += ` ${rest}`;
                    } else {
                        lines.push(current);
                        current = rest;
                    }
                });

                return [...lines, current].join(breakStr);
            })
            .join(breakStr);
    }

    /** Replace characters from `index` (negative counts from the end) with `character`; `length` defaults to the rest. */
    static mask({string, character, index, length}: {string: string; character: string; index: number; length?: number}): string {
        const segment = substr({string, start: index, length});

        if (segment === '') {
            return string;
        }

        const total = StringUtils.lengthOf(string);
        const startIndex = index < 0 ? Math.max(0, total + index) : index;
        const segmentLength = StringUtils.lengthOf(segment);

        return (
            substr({string, start: 0, length: startIndex}) +
            toChars(character)[0]?.repeat(segmentLength) +
            substr({string, start: startIndex + segmentLength})
        );
    }

    static padBoth({value, length, pad = ' '}: {value: string; length: number; pad?: string}): string {
        const total = length - StringUtils.lengthOf(value);

        if (total <= 0 || pad === '') {
            return value;
        }

        const left = Math.floor(total / 2);
        const fill = (count: number) => pad.repeat(Math.ceil(count / pad.length)).slice(0, count);

        return fill(left) + value + fill(total - left);
    }

    static padLeft({value, length, pad = ' '}: {value: string; length: number; pad?: string}): string {
        return value.padStart(length, pad);
    }

    static padRight({value, length, pad = ' '}: {value: string; length: number; pad?: string}): string {
        return value.padEnd(length, pad);
    }

    static repeat({string, times}: {string: string; times: number}): string {
        return string.repeat(Math.max(0, times));
    }

    static position({haystack, needle, offset = 0}: {haystack: string; needle: string; offset?: number}): number | null {
        const from = offset < 0 ? Math.max(0, haystack.length + offset) : offset;
        const index = haystack.indexOf(needle, from);
        return index === -1 ? null : index;
    }

    static substr({string, start, length}: {string: string; start: number; length?: number}): string {
        return substr({string, start, length});
    }

    static take({string, limit}: {string: string; limit: number}): string {
        return limit < 0 ? substr({string, start: limit}) : substr({string, start: 0, length: limit});
    }

    static substrCount({haystack, needle, offset = 0, length}: {haystack: string; needle: string; offset?: number; length?: number}): number {
        if (needle === '') {
            throw new Error('The needle must not be empty.');
        }

        return substr({string: haystack, start: offset, length}).split(needle).length - 1;
    }

    /** Replace `length` characters from `offset` with `replace`; a `length` of 0 inserts. */
    static substrReplace({string, replace, offset = 0, length}: {string: string; replace: string; offset?: number; length?: number}): string {
        const chars = toChars(string);
        const start = offset < 0 ? Math.max(0, chars.length + offset) : Math.min(offset, chars.length);
        const size = length ?? chars.length;
        const end = size < 0 ? Math.max(start, chars.length + size) : Math.min(chars.length, start + size);

        return chars.slice(0, start).join('') + replace + chars.slice(end).join('');
    }

    /** Replace every match. `replace` can be a list matched to `search` by position. */
    static replace({
        search,
        replace,
        subject,
        caseSensitive = true,
    }: {
        search: Needles;
        replace: Needles;
        subject: string;
        caseSensitive?: boolean;
    }): string {
        return list(search).reduce((result, needle, index) => {
            if (needle === '') {
                return result;
            }

            const value = typeof replace === 'string' ? replace : (replace[index] ?? '');
            return result.replace(new RegExp(escapeRegExp(needle), caseSensitive ? 'g' : 'gi'), () => value);
        }, subject);
    }

    static remove({search, subject, caseSensitive = true}: {search: Needles; subject: string; caseSensitive?: boolean}): string {
        return StringUtils.replace({search, replace: '', subject, caseSensitive});
    }

    /** Replace each occurrence of `search` with the next item of `replace`; extra occurrences stay as they are. */
    static replaceArray({search, replace, subject}: {search: string; replace: string[]; subject: string}): string {
        const queue = [...replace];
        const [first = '', ...rest] = subject.split(search);

        return rest.reduce((result, segment) => result + (queue.shift() ?? search) + segment, first);
    }

    /** Like `replaceArray`, but `pattern` is a regular expression. */
    static pregReplaceArray({pattern, replacements, subject}: {pattern: RegExp | string; replacements: string[]; subject: string}): string {
        const queue = [...replacements];
        const regex =
            typeof pattern === 'string'
                ? new RegExp(pattern, 'g')
                : new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);

        return subject.replace(regex, match => queue.shift() ?? match);
    }

    static replaceFirst({search, replace, subject}: {search: string; replace: string; subject: string}): string {
        const index = search === '' ? -1 : subject.indexOf(search);
        return index === -1 ? subject : subject.slice(0, index) + replace + subject.slice(index + search.length);
    }

    static replaceLast({search, replace, subject}: {search: string; replace: string; subject: string}): string {
        const index = search === '' ? -1 : subject.lastIndexOf(search);
        return index === -1 ? subject : subject.slice(0, index) + replace + subject.slice(index + search.length);
    }

    static replaceStart({search, replace, subject}: {search: string; replace: string; subject: string}): string {
        return search !== '' && subject.startsWith(search) ? replace + subject.slice(search.length) : subject;
    }

    static replaceEnd({search, replace, subject}: {search: string; replace: string; subject: string}): string {
        return search !== '' && subject.endsWith(search) ? subject.slice(0, subject.length - search.length) + replace : subject;
    }

    /** Regex replace. `replace` is a string (`$1` works) or a callback; `limit` caps the replacements. */
    static replaceMatches({
        pattern,
        replace,
        subject,
        limit = -1,
    }: {
        pattern: RegExp | string;
        replace: string | ((match: string, ...groups: any[]) => string);
        subject: string;
        limit?: number;
    }): string {
        const source = typeof pattern === 'string' ? pattern : pattern.source;
        const flags = typeof pattern === 'string' ? '' : pattern.flags.replace('g', '');
        const global = new RegExp(source, `${flags}g`);

        if (limit < 0) {
            return subject.replace(global, replace as any);
        }

        const single = new RegExp(source, flags);
        let count = 0;

        return subject.replace(global, (match, ...groups) => {
            if (count++ >= limit) {
                return match;
            }

            return typeof replace === 'function' ? replace(match, ...groups) : match.replace(single, replace);
        });
    }

    /** Replace many strings at once, so a replacement is never matched again. Longer keys win. */
    static swap({map, subject}: {map: Record<string, string>; subject: string}): string {
        const keys = Object.keys(map)
            .filter(Boolean)
            .sort((a, b) => b.length - a.length);

        if (keys.length === 0) {
            return subject;
        }

        return subject.replace(new RegExp(keys.map(escapeRegExp).join('|'), 'g'), match => map[match] ?? match);
    }

    /** First capture group of the first match (or the whole match), `''` when nothing matches. */
    static match({pattern, subject}: {pattern: RegExp | string; subject: string}): string {
        const matched = subject.match(typeof pattern === 'string' ? new RegExp(pattern) : new RegExp(pattern.source, pattern.flags.replace('g', '')));
        return matched ? (matched[1] ?? matched[0]) : '';
    }

    static matchAll({pattern, subject}: {pattern: RegExp | string; subject: string}): string[] {
        const source = typeof pattern === 'string' ? pattern : pattern.source;
        const flags = typeof pattern === 'string' ? '' : pattern.flags.replace('g', '');

        return Array.from(subject.matchAll(new RegExp(source, `${flags}g`)), matched => matched[1] ?? matched[0]);
    }

    static isMatch({pattern, value}: {pattern: RegExp | string | (RegExp | string)[]; value: string}): boolean {
        return list(pattern).some(item =>
            (typeof item === 'string' ? new RegExp(item) : new RegExp(item.source, item.flags.replace('g', ''))).test(value),
        );
    }

    /** Wildcard match where `*` stands for any characters: `is({pattern: 'foo*', value: 'foobar'})`. */
    static is({pattern, value, ignoreCase = false}: {pattern: Needles; value: string; ignoreCase?: boolean}): boolean {
        return list(pattern).some(item => {
            if (item === value) {
                return true;
            }

            const source = `^${escapeRegExp(item).replace(/\\\*/g, '.*')}$`;
            return new RegExp(source, `s${ignoreCase ? 'i' : ''}`).test(value);
        });
    }

    static isAscii(value: string): boolean {
        return /^[\x00-\x7F]*$/.test(value);
    }

    static isJson(value: string): boolean {
        try {
            JSON.parse(value);
            return true;
        } catch {
            return false;
        }
    }

    static isUlid(value: string): boolean {
        return /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(value);
    }

    /** Without `version` any RFC 9562 UUID passes, including the nil and max ones. */
    static isUuid({value, version}: {value: string; version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'nil' | 'max'}): boolean {
        if (version === 'nil') {
            return value === '00000000-0000-0000-0000-000000000000';
        }

        if (version === 'max') {
            return value.toLowerCase() === 'ffffffff-ffff-ffff-ffff-ffffffffffff';
        }

        const digit = version === undefined ? '[1-8]' : String(version);
        const matches = new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-${digit}[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, 'i').test(value);

        return matches || (version === undefined && (StringUtils.isUuid({value, version: 'nil'}) || StringUtils.isUuid({value, version: 'max'})));
    }

    /** Needs `scheme://host`. Pass `protocols` to restrict the allowed schemes. */
    static isUrl({value, protocols = []}: {value: string; protocols?: string[]}): boolean {
        const scheme = protocols.length ? protocols.map(escapeRegExp).join('|') : '[a-z][a-z0-9+.-]*';
        const host =
            '(?:localhost|(?:[\\p{L}\\p{N}](?:[\\p{L}\\p{N}-]{0,61}[\\p{L}\\p{N}])?\\.)+\\p{L}{2,}|\\d{1,3}(?:\\.\\d{1,3}){3}|\\[[0-9a-f:.]+\\])';

        return new RegExp(`^(?:${scheme})://(?:[^\\s@/]+@)?${host}(?::\\d{1,5})?(?:[/?#]\\S*)?$`, 'iu').test(value);
    }

    /** Remove all whitespace runs at the edges and collapse the ones inside to a single space. */
    static squish(value: string): string {
        return value.replace(/^[\s﻿]+|[\s﻿]+$/gu, '').replace(/[\sㅤᅠ]+/gu, ' ');
    }

    static trim({value, chars}: {value: string; chars?: string}): string {
        return value.replace(trimPattern({chars, side: 'both'}), '');
    }

    static ltrim({value, chars}: {value: string; chars?: string}): string {
        return value.replace(trimPattern({chars, side: 'left'}), '');
    }

    static rtrim({value, chars}: {value: string; chars?: string}): string {
        return value.replace(trimPattern({chars, side: 'right'}), '');
    }

    /** Replace accents and common Latin letters with ASCII; anything else becomes `unknown`. */
    static transliterate({value, unknown = '?'}: {value: string; unknown?: string}): string {
        return toAscii({value, onUnknown: () => unknown});
    }

    static ascii(value: string): string {
        return StringUtils.transliterate({value});
    }

    /** URL-friendly lowercase text. Letters outside Latin that cannot be transliterated are kept. */
    static slug({title, separator = '-'}: {title: string; separator?: string}): string {
        const flip = separator === '-' ? '_' : '-';
        const ascii = toAscii({value: title, onUnknown: char => char});
        const edge = escapeRegExp(separator);

        return ascii
            .replace(new RegExp(`[${escapeRegExp(flip)}]+`, 'g'), separator)
            .replace(/@/g, `${separator}at${separator}`)
            .toLowerCase()
            .replace(new RegExp(`[^${edge}\\p{L}\\p{N}\\s]+`, 'gu'), '')
            .replace(new RegExp(`[${edge}\\s]+`, 'gu'), separator)
            .replace(new RegExp(`^(?:${edge})+|(?:${edge})+$`, 'g'), '');
    }

    static plural({value, count = 2}: {value: string; count?: number | unknown[]}): string {
        if ((Array.isArray(count) ? count.length : count) === 1) {
            return value;
        }

        return inflect({value, rules: PLURAL_RULES, irregular: IRREGULAR_PLURALS, alreadyDone: IRREGULAR_SINGULARS});
    }

    /** Pluralise the last word of a StudlyCase value: "VerifiedHuman" -> "VerifiedHumans". */
    static pluralStudly({value, count = 2}: {value: string; count?: number | unknown[]}): string {
        const parts = StringUtils.ucsplit(value);
        const last = parts.pop() ?? '';

        return parts.join('') + StringUtils.plural({value: last, count});
    }

    static singular(value: string): string {
        return inflect({value, rules: SINGULAR_RULES, irregular: IRREGULAR_SINGULARS, alreadyDone: IRREGULAR_PLURALS});
    }

    static swapCase(value: string): string {
        return toChars(value)
            .map(char => (char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase()))
            .join('');
    }

    /** Escape the HTML special characters in `value`. */
    static e(value: string): string {
        return value.replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'})[char] as string);
    }

    /** UTF-8 safe, so it works with emoji and other non-Latin text. */
    static toBase64(value: string): string {
        const bytes = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        let output = '';

        for (let i = 0; i < bytes.length; i += 3) {
            const [a = 0, b, c] = [bytes.charCodeAt(i), bytes.charCodeAt(i + 1), bytes.charCodeAt(i + 2)];
            const chunk = (a << 16) | ((b || 0) << 8) | (c || 0);
            output += BASE64[(chunk >> 18) & 63];
            output += BASE64[(chunk >> 12) & 63];
            output += i + 1 < bytes.length ? BASE64[(chunk >> 6) & 63] : '=';
            output += i + 2 < bytes.length ? BASE64[chunk & 63] : '=';
        }

        return output;
    }

    /** Returns `null` for invalid Base64 or bytes that are not valid UTF-8. */
    static fromBase64(value: string): string | null {
        const clean = value.replace(/\s+/g, '').replace(/[=]{1,2}$/, '');

        if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) {
            return null;
        }

        let bytes = '';
        let buffer = 0;
        let bits = 0;

        for (const char of clean) {
            buffer = (buffer << 6) | BASE64.indexOf(char);
            bits += 6;

            if (bits >= 8) {
                bits -= 8;
                bytes += String.fromCharCode((buffer >> bits) & 255);
            }
        }

        try {
            return decodeURIComponent(bytes.replace(/[\s\S]/g, char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`));
        } catch {
            return null;
        }
    }

    /** Secure random alphanumeric string. Needs a `crypto.getRandomValues` global. */
    static random(length = 16): string {
        return randomFrom({alphabet: toChars('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'), length});
    }

    static password({
        length = 32,
        letters = true,
        numbers = true,
        symbols = true,
        spaces = false,
    }: {
        length?: number;
        letters?: boolean;
        numbers?: boolean;
        symbols?: boolean;
        spaces?: boolean;
    } = {}): string {
        const alphabet = [
            letters && 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
            numbers && '0123456789',
            symbols && '~!#$%^&*()-_.,<>?/\\{}[]|:;',
            spaces && ' ',
        ]
            .filter(Boolean)
            .join('');

        if (alphabet === '') {
            throw new Error('Enable at least one of letters, numbers, symbols or spaces.');
        }

        return randomFrom({alphabet: toChars(alphabet), length});
    }

    /** Random (version 4) UUID. Needs a `crypto.getRandomValues` global. */
    static uuid(): string {
        const bytes = randomBytes(16);
        bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
        bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

        return formatUuid(bytes);
    }

    /** Time-ordered (version 7) UUID: sorts by creation time. */
    static uuid7(): string {
        const bytes = new Uint8Array(16);
        bytes.set(randomBytes(10), 6);

        let time = Date.now();

        for (let i = 5; i >= 0; i--) {
            bytes[i] = time % 256;
            time = Math.floor(time / 256);
        }

        bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
        bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

        return formatUuid(bytes);
    }

    static orderedUuid(): string {
        return StringUtils.uuid7();
    }

    /** 26-character, time-sortable ULID. */
    static ulid(): string {
        let time = Date.now();
        let prefix = '';

        for (let i = 0; i < 10; i++) {
            prefix = CROCKFORD.charAt(time % 32) + prefix;
            time = Math.floor(time / 32);
        }

        return prefix + randomFrom({alphabet: toChars(CROCKFORD), length: 16});
    }
}

export default StringUtils;
