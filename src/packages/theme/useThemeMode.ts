import {useCallback, useContext} from 'react';
import {useColorScheme} from 'react-native';

import ThemeContext from './ThemeContext';

import type {ThemeMode} from './types';

/**
 * Reads and switches the color mode: `const {isDark, mode, setMode, toggleMode} = useThemeMode()`.
 * Outside a provider it reports the device scheme and `setMode` does nothing.
 */
export default function useThemeMode() {
    const context = useContext(ThemeContext);
    const scheme = useColorScheme();
    const setMode = context?.setMode;
    const isDark = context ? context.isDark : scheme === 'dark';

    const toggleMode = useCallback(() => setMode?.(isDark ? 'light' : 'dark'), [isDark, setMode]);
    const set = useCallback((mode: ThemeMode) => setMode?.(mode), [setMode]);

    return {mode: context?.mode ?? ('system' as ThemeMode), isDark, setMode: set, toggleMode};
}
