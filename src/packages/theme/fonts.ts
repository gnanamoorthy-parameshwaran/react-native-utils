import {Platform} from 'react-native';

import type {FontStyle, Fonts, TypescaleKey} from './types';

const defaultFamily = Platform.select({ios: 'System', android: 'sans-serif', default: 'System'});

const scale = ({size, line, weight = '400', spacing = 0}: {size: number; line: number; weight?: FontStyle['fontWeight']; spacing?: number}) => ({
    fontSize: size,
    lineHeight: line,
    fontWeight: weight,
    letterSpacing: spacing,
});

/** Material Design 3 type scale without a font family; `configureFonts` adds the family. */
const typescale: Record<TypescaleKey, Omit<FontStyle, 'fontFamily'>> = {
    displayLarge: scale({size: 57, line: 64}),
    displayMedium: scale({size: 45, line: 52}),
    displaySmall: scale({size: 36, line: 44}),
    headlineLarge: scale({size: 32, line: 40}),
    headlineMedium: scale({size: 28, line: 36}),
    headlineSmall: scale({size: 24, line: 32}),
    titleLarge: scale({size: 22, line: 28}),
    titleMedium: scale({size: 16, line: 24, weight: '500', spacing: 0.15}),
    titleSmall: scale({size: 14, line: 20, weight: '500', spacing: 0.1}),
    labelLarge: scale({size: 14, line: 20, weight: '500', spacing: 0.1}),
    labelMedium: scale({size: 12, line: 16, weight: '500', spacing: 0.5}),
    labelSmall: scale({size: 11, line: 16, weight: '500', spacing: 0.5}),
    bodyLarge: scale({size: 16, line: 24, spacing: 0.15}),
    bodyMedium: scale({size: 14, line: 20, spacing: 0.25}),
    bodySmall: scale({size: 12, line: 16, spacing: 0.4}),
};

type FontConfig = {fontFamily?: string} & Partial<Record<TypescaleKey, Partial<FontStyle>>> & {default?: Partial<Fonts['default']>};

/**
 * Builds the font set. `fontFamily` applies to every variant, and a variant key overrides single
 * properties of that variant: `configureFonts({config: {fontFamily: 'Inter', bodyLarge: {fontSize: 17}}})`.
 */
export const configureFonts = ({config = {}}: {config?: FontConfig} = {}): Fonts => {
    const family = config.fontFamily ?? (defaultFamily as string);
    const fonts = {default: {fontFamily: family, fontWeight: '400', letterSpacing: 0, ...config.default}} as Fonts;

    (Object.keys(typescale) as TypescaleKey[]).forEach(key => {
        fonts[key] = {fontFamily: family, ...typescale[key], ...config[key]};
    });

    return fonts;
};
