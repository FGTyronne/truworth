import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://npfdkbqjoxolxxtmprmr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0Sohm-jtjfxMQ8fpM3zsAg_iF7oF1fo';
const CHUNK_SIZE = 1800;

const safeKey = (key: string) => `tw_${key.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
const metadataKey = (key: string) => `${safeKey(key)}_meta`;
const chunkKey = (key: string, index: number) => `${safeKey(key)}_${index}`;

async function chunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(metadataKey(key));
  const parsed = Number(raw || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

async function removeChunks(key: string): Promise<void> {
  const count = await chunkCount(key);
  await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(chunkKey(key, index))));
  await SecureStore.deleteItemAsync(metadataKey(key));
}

const secureStorage: SupportedStorage = {
  async getItem(key) {
    const count = await chunkCount(key);
    if (!count) return null;
    const chunks = await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))));
    if (chunks.some((part) => part == null)) return null;
    return chunks.join('');
  },
  async setItem(key, value) {
    await removeChunks(key);
    const chunks = Array.from({ length: Math.ceil(value.length / CHUNK_SIZE) }, (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
    for (let index = 0; index < chunks.length; index += 1) {
      await SecureStore.setItemAsync(chunkKey(key, index), chunks[index] ?? '');
    }
    await SecureStore.setItemAsync(metadataKey(key), String(chunks.length));
  },
  async removeItem(key) {
    await removeChunks(key);
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

export function startAuthRefreshLifecycle(): () => void {
  if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
  };
}
