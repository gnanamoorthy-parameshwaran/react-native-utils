import {useEffect, useMemo, useState} from 'react';
import {useColorScheme} from 'react-native';

import ThemeContext from './ThemeContext';
import {createTheme} from './createTheme';
import {mergeTheme, useStableValue} from './utils';

import type {ReactNode} from 'react';
import type {DeepPartial, Theme, ThemeContextValue, ThemeMode} from './types';

type ThemeProviderProps = {
    /** Overrides applied to both the light and the dark theme. */
    theme?: DeepPartial<Theme>;
    /** Overrides applied only while the light theme is active. */
    light?: DeepPartial<Theme>;
    /** Overrides applied only while the dark theme is active. */
    dark?: DeepPartial<Theme>;
    /** `'system'` (default) follows the device; `'light'` and `'dark'` force one. Changing the prop updates the mode. */
    mode?: ThemeMode;
    children?: ReactNode;
};

/**
 * Provides the theme to `useTheme`, `withTheme` and `useThemedStyles`. Without props it follows the
 * device color scheme using the built-in light and dark themes.
 *
 * `<ThemeProvider theme={{roundness: 12}} light={{colors: {primary: '#0a7'}}} dark={{colors: {primary: '#4fd'}}}>`
 */
export default function ThemeProvider({theme, light, dark, mode: modeProp = 'system', children}: ThemeProviderProps) {
    const scheme = useColorScheme();
    const [mode, setMode] = useState<ThemeMode>(modeProp);
    const shared = useStableValue(theme);
    const lightOverrides = useStableValue(light);
    const darkOverrides = useStableValue(dark);

    useEffect(() => {
        setMode(modeProp);
    }, [modeProp]);

    const value = useMemo<ThemeContextValue>(() => {
        const wantsDark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
        const isDark = shared?.dark ?? wantsDark;
        const sideOverrides = isDark ? darkOverrides : lightOverrides;
        const resolved = createTheme({overrides: mergeTheme({base: (shared ?? {}) as DeepPartial<Theme>, overrides: sideOverrides}), dark: isDark});

        return {theme: resolved, mode, isDark: resolved.dark, setMode};
    }, [mode, scheme, shared, lightOverrides, darkOverrides]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
