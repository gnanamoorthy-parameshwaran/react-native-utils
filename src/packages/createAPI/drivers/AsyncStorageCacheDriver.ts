import AsyncStorage from '@react-native-async-storage/async-storage';

import type {APICacheDriver, CacheEntry} from '../types';

const KEY_PREFIX = 'api_cache:';

export default class AsyncStorageCacheDriver implements APICacheDriver {
    async get<T>(key: string): Promise<T | undefined> {
        const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
        if (!raw) return undefined;

        const entry: CacheEntry = JSON.parse(raw);

        if (Date.now() > entry.expiresAt) {
            await AsyncStorage.removeItem(KEY_PREFIX + key);
            return undefined;
        }

        return entry.value as T;
    }

    async set(key: string, value: unknown, ttl: number): Promise<void> {
        const entry: CacheEntry = {value, expiresAt: Date.now() + ttl};
        await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(entry));
    }

    async delete(key: string): Promise<void> {
        await AsyncStorage.removeItem(KEY_PREFIX + key);
    }

    async deleteAll(): Promise<void> {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(k => k.startsWith(KEY_PREFIX));
        if (cacheKeys.length > 0) {
            await AsyncStorage.removeMany(cacheKeys);
        }
    }
}
