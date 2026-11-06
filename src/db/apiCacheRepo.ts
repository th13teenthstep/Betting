import { getDb } from './database';

export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

/** Kalici API onbellegi (SQLite). Bozuk/okunamayan kayit "yok" sayilir. */
export async function getCache<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ payload: string; fetched_at: number }>(
      `SELECT payload, fetched_at FROM api_cache WHERE key = ?`,
      [key],
    );
    if (!row) return null;
    return { data: JSON.parse(row.payload) as T, fetchedAt: row.fetched_at };
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO api_cache (key, payload, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
      [key, JSON.stringify(data), Date.now()],
    );
  } catch (e) {
    console.warn('[Cache] yazilamadi:', e);
  }
}
