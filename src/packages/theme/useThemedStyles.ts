import {useMemo} from 'react';
import {StyleSheet} from 'react-native';

import useTheme from './useTheme';

import type {Theme} from './types';

/**
 * Styles that depend on the theme, rebuilt only when the theme changes. Declare the factory at module
 * level (outside the component) so its identity stays stable:
 *
 * `const createStyles = (theme: Theme) => ({card: {backgroundColor: theme.colors.surface}})`
 * `const styles = useThemedStyles(createStyles)`
 */
export default function useThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(factory: (theme: Theme) => T): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
}
