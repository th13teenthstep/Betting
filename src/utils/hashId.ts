/**
 * TheStatsAPI string id'lerini (mt_*, tm_*) Fixture/Standing tiplerinin
 * bekledigi sabit numerik id'ye cevirir. Ayni string her zaman ayni sayiyi
 * uretir (navigasyon/keyExtractor bu kararliliga dayaniyor).
 */
export function hashId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
