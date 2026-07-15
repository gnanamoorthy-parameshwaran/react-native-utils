import {useCallback} from 'react';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

export default function useTranslation(translate: TranslateFn) {
    const t = useCallback(
        (key: string, params?: Record<string, unknown>) => {
            return translate(key, params);
        },
        [translate],
    );

    return {t};
}
