import {createContext} from 'react';

import type {ThemeContextValue} from './types';

/** `null` outside a provider; the hooks then fall back to the default theme for the device color scheme. */
const ThemeContext = createContext<ThemeContextValue | null>(null);

export default ThemeContext;
