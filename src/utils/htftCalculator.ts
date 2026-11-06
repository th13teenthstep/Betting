import type { HtFtResult, FixtureScore } from '../types/football';

/**
 * IY ve MS skorlarindan IY/MS sonucunu turetir.
 *
 * Kurallar:
 *   "1" = ev sahibi onde
 *   "X" = beraberlik
 *   "2" = deplasman onde
 *
 * Ornekler:
 *   iy {home: 0, away: 0} ms {home: 2, away: 1} → "X/1"
 *   iy {home: 1, away: 0} ms {home: 1, away: 0} → "1/1"
 *   iy {home: 0, away: 1} ms {home: 2, away: 1} → "2/1"
 */
export function getHtFtOutcome(
  halftime: FixtureScore,
  fulltime: FixtureScore,
): HtFtResult | null {
  // Iki yarinin da skoru belli olmali
  if (
    halftime.home === null ||
    halftime.away === null ||
    fulltime.home === null ||
    fulltime.away === null
  ) {
    return null;
  }

  const htSymbol = skorSembol(halftime.home, halftime.away);
  const ftSymbol = skorSembol(fulltime.home, fulltime.away);

  return `${htSymbol}/${ftSymbol}` as HtFtResult;
}

/** Ev/deplasman skor ikilisini sonuc sembolune cevirir. */
function skorSembol(ev: number, deplasman: number): '1' | 'X' | '2' {
  if (ev > deplasman) return '1';
  if (ev < deplasman) return '2';
  return 'X';
}

/**
 * IY/MS sonucu icin okunakli Turkce etiket dondurur.
 * Orn. "1/2" → "Ev / Deplasman"
 */
export function htFtLabel(outcome: HtFtResult): string {
  const map: Record<HtFtResult, string> = {
    '1/1': 'Ev / Ev',
    '1/X': 'Ev / Beraberlik',
    '1/2': 'Ev / Deplasman',
    'X/1': 'Beraberlik / Ev',
    'X/X': 'Beraberlik / Beraberlik',
    'X/2': 'Beraberlik / Deplasman',
    '2/1': 'Deplasman / Ev',
    '2/X': 'Deplasman / Beraberlik',
    '2/2': 'Deplasman / Deplasman',
  };
  return map[outcome];
}