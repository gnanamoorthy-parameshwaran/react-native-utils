import type {ViewStyle} from 'react-native';

import type {ElevationLevel, Theme} from './types';

export type Elevation = 0 | 1 | 2 | 3 | 4 | 5;

/** Material Design 3 elevation levels: Android elevation in dp, plus matching iOS shadow values. */
const LEVELS: Record<Elevation, {elevation: number; offset: number; radius: number; opacity: number}> = {
    0: {elevation: 0, offset: 0, radius: 0, opacity: 0},
    1: {elevation: 1, offset: 1, radius: 2, opacity: 0.18},
    2: {elevation: 3, offset: 2, radius: 4, opacity: 0.2},
    3: {elevation: 6, offset: 4, radius: 6, opacity: 0.22},
    4: {elevation: 8, offset: 6, radius: 8, opacity: 0.24},
    5: {elevation: 12, offset: 8, radius: 10, opacity: 0.26},
};

const clampLevel = (level: number) => Math.min(5, Math.max(0, Math.round(level))) as Elevation;

/** The tinted surface color for an elevation level (0 to 5). */
export const surfaceColor = ({theme, level}: {theme: Theme; level: number}) => theme.colors.elevation[`level${clampLevel(level)}` as ElevationLevel];

/** Shadow style that works on both platforms: `shadow*` on iOS, `elevation` on Android. */
export const shadowStyle = ({level, color = '#000000'}: {level: number; color?: string}): ViewStyle => {
    const {elevation, offset, radius, opacity} = LEVELS[clampLevel(level)];

    return {shadowColor: color, shadowOffset: {width: 0, height: offset}, shadowOpacity: opacity, shadowRadius: radius, elevation};
};
