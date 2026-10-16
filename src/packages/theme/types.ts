import type {TextStyle} from 'react-native';

export type DeepPartial<T> = {[K in keyof T]?: T[K] extends (...args: any[]) => unknown ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K]};

export type FontStyle = {
    fontFamily: string;
    fontSize: number;
    fontWeight: TextStyle['fontWeight'];
    letterSpacing: number;
    lineHeight: number;
    fontStyle?: TextStyle['fontStyle'];
};

export type TypescaleKey =
    | 'displayLarge'
    | 'displayMedium'
    | 'displaySmall'
    | 'headlineLarge'
    | 'headlineMedium'
    | 'headlineSmall'
    | 'titleLarge'
    | 'titleMedium'
    | 'titleSmall'
    | 'labelLarge'
    | 'labelMedium'
    | 'labelSmall'
    | 'bodyLarge'
    | 'bodyMedium'
    | 'bodySmall';

export type Typescale = Record<TypescaleKey, FontStyle>;

/** The type scale plus `default`, the family, weight and spacing for text that has no variant. */
export type Fonts = Typescale & {default: Pick<FontStyle, 'fontFamily' | 'fontWeight' | 'letterSpacing'>};

export type ElevationLevel = 'level0' | 'level1' | 'level2' | 'level3' | 'level4' | 'level5';

export type ThemeColors = {
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondary: string;
    onSecondary: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    tertiary: string;
    onTertiary: string;
    tertiaryContainer: string;
    onTertiaryContainer: string;
    error: string;
    onError: string;
    errorContainer: string;
    onErrorContainer: string;
    background: string;
    onBackground: string;
    surface: string;
    onSurface: string;
    surfaceVariant: string;
    onSurfaceVariant: string;
    outline: string;
    outlineVariant: string;
    shadow: string;
    scrim: string;
    inverseSurface: string;
    inverseOnSurface: string;
    inversePrimary: string;
    elevation: Record<ElevationLevel, string>;
    surfaceDisabled: string;
    onSurfaceDisabled: string;
    backdrop: string;
};

export type Theme = {
    dark: boolean;
    roundness: number;
    animation: {scale: number; defaultAnimationDuration: number};
    colors: ThemeColors;
    fonts: Fonts;
};

export type ThemeMode = 'system' | 'light' | 'dark';

export type ThemeContextValue = {
    theme: Theme;
    mode: ThemeMode;
    isDark: boolean;
    setMode: (mode: ThemeMode) => void;
};
