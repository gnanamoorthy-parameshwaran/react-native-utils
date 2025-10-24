import {useCallback} from 'react';
import {translate} from '../../Translations';

export default function useTranslation() {
  const t = useCallback((key: string, params?: Record<string, any>) => {
    return translate(key, params);
  }, []);

  return {t};
}
