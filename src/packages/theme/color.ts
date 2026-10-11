export type Rgba = {r: number; g: number; b: number; a: number};

const NAMED: Record<string, string> = {transparent: 'rgba(0, 0, 0, 0)', black: '#000000', white: '#ffffff'};

const clamp = ({value, min, max}: {value: number; min: number; max: number}) => Math.min(max, Math.max(min, value));
const parseAlpha = (value: string | undefined) =>
    value === undefined ? 1 : clamp({value: value.endsWith('%') ? parseFloat(value) / 100 : parseFloat(value), min: 0, max: 1});

const hslToRgb = ({h, s, l}: {h: number; s: number; l: number}) => {
    const hue = (((h % 360) + 360) % 360) / 360;
    const saturation = s / 100;
    const lightness = l / 100;
    const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;

    const channel = (shifted: number) => {
        const t = (shifted + 1) % 1;
        const value = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
        return Math.round(value * 255);
    };

    return {r: channel(hue + 1 / 3), g: channel(hue), b: channel(hue - 1 / 3)};
};

/** Reads `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, `hsla()`, `transparent`, `black` and `white`. */
export const parseColor = (value: string): Rgba => {
    const text = (NAMED[value.trim().toLowerCase()] ?? value).trim().toLowerCase();
    const hex = text.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);

    if (hex) {
        const digits = (hex[1] as string).length <= 4 ? [...(hex[1] as string)].map(char => char + char).join('') : (hex[1] as string);
        const channel = (index: number) => parseInt(digits.slice(index * 2, index * 2 + 2), 16);
        return {r: channel(0), g: channel(1), b: channel(2), a: digits.length === 8 ? channel(3) / 255 : 1};
    }

    const rgb = text.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);

    if (rgb) {
        return {
            r: clamp({value: Number(rgb[1]), min: 0, max: 255}),
            g: clamp({value: Number(rgb[2]), min: 0, max: 255}),
            b: clamp({value: Number(rgb[3]), min: 0, max: 255}),
            a: parseAlpha(rgb[4]),
        };
    }

    const hsl = text.match(/^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/);

    if (hsl) {
        return {...hslToRgb({h: Number(hsl[1]), s: Number(hsl[2]), l: Number(hsl[3])}), a: parseAlpha(hsl[4])};
    }

    throw new Error(`Unsupported color "${value}".`);
};

/** `rgb(r, g, b)` when opaque, otherwise `rgba(r, g, b, a)`. */
export const toRgbString = ({r, g, b, a}: Rgba) => {
    const [red, green, blue] = [r, g, b].map(channel => Math.round(clamp({value: channel, min: 0, max: 255})));
    const alpha = Math.round(clamp({value: a, min: 0, max: 1}) * 1000) / 1000;

    return alpha === 1 ? `rgb(${red}, ${green}, ${blue})` : `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

/** `#rrggbb`, or `#rrggbbaa` when the color is not opaque. */
export const toHex = (color: string) => {
    const {r, g, b, a} = parseColor(color);
    const hex = (value: number) => Math.round(value).toString(16).padStart(2, '0');

    return `#${hex(r)}${hex(g)}${hex(b)}${a < 1 ? hex(a * 255) : ''}`;
};

export const withAlpha = ({color, alpha}: {color: string; alpha: number}) =>
    toRgbString({...parseColor(color), a: clamp({value: alpha, min: 0, max: 1})});

/** Blend `from` toward `to`; `weight` is how much of `to` ends up in the result (0 to 1). */
export const mix = ({from, to, weight = 0.5}: {from: string; to: string; weight?: number}) => {
    const a = parseColor(from);
    const b = parseColor(to);
    const w = clamp({value: weight, min: 0, max: 1});

    return toRgbString({r: a.r + (b.r - a.r) * w, g: a.g + (b.g - a.g) * w, b: a.b + (b.b - a.b) * w, a: a.a + (b.a - a.a) * w});
};

export const lighten = ({color, amount}: {color: string; amount: number}) => mix({from: color, to: '#ffffff', weight: amount});

export const darken = ({color, amount}: {color: string; amount: number}) => mix({from: color, to: '#000000', weight: amount});

/** Perceived brightness check (YIQ), the one most UI kits use to choose a text color. */
export const isDarkColor = (color: string) => {
    const {r, g, b} = parseColor(color);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
};

/** `light` text on dark backgrounds, `dark` text on light ones. */
export const contrastText = ({color, light = '#ffffff', dark = '#000000'}: {color: string; light?: string; dark?: string}) =>
    isDarkColor(color) ? light : dark;

/** WCAG relative luminance, 0 (black) to 1 (white). */
export const luminance = (color: string) => {
    const channel = (value: number) => {
        const scaled = value / 255;
        return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
    };
    const {r, g, b} = parseColor(color);

    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG contrast ratio, 1 to 21. 4.5 is the usual minimum for body text. */
export const contrastRatio = ({a, b}: {a: string; b: string}) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (high + 0.05) / (low + 0.05);
};
