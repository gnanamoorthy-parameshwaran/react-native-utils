import {darkColors, lightColors} from './tokens';
import {configureFonts} from './fonts';
import {mergeTheme} from './utils';

import type {DeepPartial, Theme} from './types';

export const LightTheme: Theme = {
    dark: false,
    roundness: 4,
    animation: {scale: 1.0, defaultAnimationDuration: 250},
    colors: lightColors,
    fonts: configureFonts(),
};

export const DarkTheme: Theme = {...LightTheme, dark: true, colors: darkColors};

export const DefaultTheme = LightTheme;

/**
 * Builds a full theme from overrides. `base` defaults to the light or dark theme depending on `dark`,
 * which also follows `overrides.dark` when you set it there.
 *
 * `createTheme({overrides: {colors: {primary: '#0a7'}, roundness: 8}})`
 */
export const createTheme = <T extends Theme = Theme>({overrides, dark, base}: {overrides?: DeepPartial<T>; dark?: boolean; base?: Theme} = {}): T => {
    const isDark = overrides?.dark ?? dark ?? base?.dark ?? false;
    const start = base ?? (isDark ? DarkTheme : LightTheme);

    return mergeTheme({base: start as T, overrides: {...overrides, dark: isDark} as DeepPartial<T>});
};
