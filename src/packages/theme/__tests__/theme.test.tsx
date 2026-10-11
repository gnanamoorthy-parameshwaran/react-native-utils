import React from 'react';
import {Text} from 'react-native';
import {useColorScheme} from 'react-native';
import {act, render, renderHook} from '@testing-library/react-native';

import {
    ColorUtils,
    DarkTheme,
    LightTheme,
    ThemeProvider,
    configureFonts,
    createTheme,
    shadowStyle,
    surfaceColor,
    useTheme,
    useThemeMode,
    useThemedStyles,
    withTheme,
} from '..';

import type {ReactNode} from 'react';
import type {Theme} from '..';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({__esModule: true, default: jest.fn(() => 'light')}));

const mockScheme = useColorScheme as jest.Mock;

const wrapper =
    (props: React.ComponentProps<typeof ThemeProvider>) =>
    ({children}: {children: ReactNode}) => <ThemeProvider {...props}>{children}</ThemeProvider>;

describe('createTheme', () => {
    it('merges overrides over the light or dark base', () => {
        const light = createTheme({overrides: {colors: {primary: 'red'}, roundness: 10}});
        expect(light.colors.primary).toBe('red');
        expect(light.colors.secondary).toBe(LightTheme.colors.secondary);
        expect(light.roundness).toBe(10);
        expect(light.dark).toBe(false);

        const dark = createTheme({dark: true, overrides: {colors: {primary: 'blue'}}});
        expect(dark.dark).toBe(true);
        expect(dark.colors.background).toBe(DarkTheme.colors.background);
        expect(createTheme({overrides: {dark: true}}).colors.surface).toBe(DarkTheme.colors.surface);
    });

    it('does not mutate the built-in themes', () => {
        createTheme({overrides: {colors: {primary: 'red'}}});
        expect(LightTheme.colors.primary).toBe('rgb(103, 80, 164)');
    });
});

describe('configureFonts', () => {
    it('applies one family everywhere and per-variant overrides', () => {
        const fonts = configureFonts({config: {fontFamily: 'Inter', bodyLarge: {fontSize: 18}}});
        expect(fonts.bodyLarge).toMatchObject({fontFamily: 'Inter', fontSize: 18, lineHeight: 24});
        expect(fonts.titleLarge.fontFamily).toBe('Inter');
        expect(fonts.default.fontFamily).toBe('Inter');
        expect(Object.keys(fonts)).toHaveLength(16);
    });
});

describe('useTheme', () => {
    afterEach(() => mockScheme.mockReturnValue('light'));

    it('falls back to the device scheme without a provider', () => {
        mockScheme.mockReturnValue('dark');
        const {result} = renderHook(() => useTheme());
        expect(result.current.dark).toBe(true);
    });

    it('reads the provider theme and per-call overrides', () => {
        const {result} = renderHook(() => useTheme({colors: {primary: 'tomato'}}), {wrapper: wrapper({mode: 'light', theme: {roundness: 12}})});
        expect(result.current.roundness).toBe(12);
        expect(result.current.colors.primary).toBe('tomato');
        expect(result.current.colors.onPrimary).toBe(LightTheme.colors.onPrimary);
    });

    it('keeps the same reference for deeply equal inline overrides', () => {
        const {result, rerender} = renderHook(() => useTheme({colors: {primary: 'tomato'}}), {wrapper: wrapper({mode: 'light'})});
        const first = result.current;
        rerender({});
        expect(result.current).toBe(first);
    });

    it('applies light and dark overrides on the matching mode', () => {
        const props = {light: {colors: {primary: '#0a0'}}, dark: {colors: {primary: '#0f0'}}};
        expect(renderHook(() => useTheme(), {wrapper: wrapper({...props, mode: 'light'})}).result.current.colors.primary).toBe('#0a0');
        expect(renderHook(() => useTheme(), {wrapper: wrapper({...props, mode: 'dark'})}).result.current.colors.primary).toBe('#0f0');
    });

    it('follows the system scheme and updates when it changes', () => {
        const {result, rerender} = renderHook(() => useTheme(), {wrapper: wrapper({})});
        expect(result.current.dark).toBe(false);
        mockScheme.mockReturnValue('dark');
        rerender({});
        expect(result.current.dark).toBe(true);
    });
});

describe('useThemeMode', () => {
    it('switches the mode through the provider', () => {
        const {result} = renderHook(() => ({mode: useThemeMode(), theme: useTheme()}), {wrapper: wrapper({mode: 'light'})});
        expect(result.current.mode.isDark).toBe(false);

        act(() => result.current.mode.toggleMode());
        expect(result.current.mode.mode).toBe('dark');
        expect(result.current.theme.dark).toBe(true);

        act(() => result.current.mode.setMode('system'));
        expect(result.current.mode.mode).toBe('system');
    });

    it('follows a changed mode prop', () => {
        const {result, rerender} = renderHook(() => useThemeMode(), {
            wrapper: ({children}: {children: ReactNode}) => <ThemeProvider mode="light">{children}</ThemeProvider>,
        });
        expect(result.current.mode).toBe('light');
        rerender({});
        expect(result.current.isDark).toBe(false);
    });
});

describe('withTheme and useThemedStyles', () => {
    it('injects the theme prop and lets callers override it', () => {
        const Label = withTheme(({theme}: {theme: Theme}) => <Text testID="label">{theme.colors.primary}</Text>);
        const screen = render(
            <ThemeProvider mode="light" theme={{colors: {primary: 'purple'}}}>
                <Label />
                <Label theme={{colors: {primary: 'teal'}}} />
            </ThemeProvider>,
        );
        expect(screen.getAllByTestId('label').map(node => node.props.children)).toEqual(['purple', 'teal']);
    });

    it('builds styles from the theme', () => {
        const factory = (theme: Theme) => ({card: {backgroundColor: theme.colors.surface, borderRadius: theme.roundness}});
        const {result} = renderHook(() => useThemedStyles(factory), {wrapper: wrapper({mode: 'dark'})});
        expect(result.current.card).toMatchObject({backgroundColor: DarkTheme.colors.surface, borderRadius: 4});
    });
});

describe('ColorUtils', () => {
    it('parses and converts', () => {
        expect(ColorUtils.parseColor('#f00')).toEqual({r: 255, g: 0, b: 0, a: 1});
        expect(ColorUtils.parseColor('rgba(10, 20, 30, 0.5)')).toEqual({r: 10, g: 20, b: 30, a: 0.5});
        expect(ColorUtils.parseColor('hsl(120, 100%, 50%)')).toEqual({r: 0, g: 255, b: 0, a: 1});
        expect(ColorUtils.toHex('rgb(255, 128, 0)')).toBe('#ff8000');
        expect(ColorUtils.toHex('rgba(255, 128, 0, 0.5)')).toBe('#ff800080');
        expect(() => ColorUtils.parseColor('nope')).toThrow();
    });

    it('adjusts and compares', () => {
        expect(ColorUtils.withAlpha({color: '#000', alpha: 0.4})).toBe('rgba(0, 0, 0, 0.4)');
        expect(ColorUtils.mix({from: '#000', to: '#fff', weight: 0.5})).toBe('rgb(128, 128, 128)');
        expect(ColorUtils.lighten({color: '#000', amount: 1})).toBe('rgb(255, 255, 255)');
        expect(ColorUtils.darken({color: '#fff', amount: 1})).toBe('rgb(0, 0, 0)');
        expect(ColorUtils.isDarkColor('#111')).toBe(true);
        expect(ColorUtils.contrastText({color: '#fff'})).toBe('#000000');
        expect(ColorUtils.contrastText({color: '#000'})).toBe('#ffffff');
        expect(ColorUtils.contrastRatio({a: '#000', b: '#fff'})).toBeCloseTo(21, 0);
    });
});

describe('elevation', () => {
    it('returns surface tints and shadows', () => {
        expect(surfaceColor({theme: LightTheme, level: 2})).toBe(LightTheme.colors.elevation.level2);
        expect(surfaceColor({theme: LightTheme, level: 99})).toBe(LightTheme.colors.elevation.level5);
        expect(shadowStyle({level: 0})).toMatchObject({elevation: 0, shadowOpacity: 0});
        expect(shadowStyle({level: 3, color: '#123'})).toMatchObject({elevation: 6, shadowColor: '#123'});
    });
});
