/**
 * API isteklerinin ne kadar surdugunu (hareketli ortalama) tutar; yukleme cubugu
 * "tahmini kalan sure"yi bundan hesaplar. Ilk istekten once varsayilan kullanilir.
 */
const DEFAULT_MS = 3000;
let averageMs = DEFAULT_MS;
let samples = 0;

export function recordApiDuration(ms: number): void {
  averageMs = samples === 0 ? ms : averageMs * 0.6 + ms * 0.4;
  samples++;
}

export function expectedApiMs(): number {
  return Math.max(1200, averageMs);
}
