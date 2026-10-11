import {useContext, useMemo} from 'react';
import {useColorScheme} from 'react-native';

import ThemeContext from './ThemeContext';
import {DarkTheme, LightTheme} from './createTheme';
import {mergeTheme, useStableValue} from './utils';

import type {DeepPartial, Theme} from './types';

/**
 * The current theme. Pass `overrides` to adjust it for one component without touching the provider:
 * `const theme = useTheme({colors: {primary: 'tomato'}})`. Works without a provider too, using the
 * built-in light or dark theme for the device color scheme.
 */
export default function useTheme<T extends Theme = Theme>(overrides?: DeepPartial<T>): T {
    const context = useContext(ThemeContext);
    const scheme = useColorScheme();
    const stable = useStableValue(overrides);
    const base = (context?.theme ?? (scheme === 'dark' ? DarkTheme : LightTheme)) as T;

    return useMemo(() => mergeTheme({base, overrides: stable}), [base, stable]);
}
