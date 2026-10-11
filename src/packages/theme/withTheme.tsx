import useTheme from './useTheme';

import type {ComponentType} from 'react';
import type {DeepPartial, Theme} from './types';

/**
 * Class-component friendly access to the theme: the wrapped component receives a `theme` prop, and
 * callers may pass a partial `theme` prop of their own to override parts of it.
 */
export default function withTheme<P extends object>(Component: ComponentType<P & {theme: Theme}>): ComponentType<P & {theme?: DeepPartial<Theme>}> {
    const Themed = (props: P & {theme?: DeepPartial<Theme>}) => {
        const theme = useTheme(props.theme);
        return <Component {...(props as P)} theme={theme} />;
    };

    Themed.displayName = `withTheme(${Component.displayName ?? Component.name ?? 'Component'})`;
    return Themed;
}
