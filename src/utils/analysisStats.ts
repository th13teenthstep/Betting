import type { MatchRow } from '../db/matchesRepo';
import type { HtFtResult } from '../types/football';
import { getHtFtOutcome } from './htftCalculator';

export const HTFT_ORDER: HtFtResult[] = [
  '1/1', '1/X', '1/2', 'X/1', 'X/X', 'X/2', '2/1', '2/X', '2/2',
];

export interface AnalysisStats {
  total: number;
  /** IY skoru bilinen mac sayisi (IY/MS dagilimi bunlar uzerinden). */
  withHt: number;
  htft: Record<HtFtResult, number>;
  /** MS sonucu dagilimi. */
  ft: { home: number; draw: number; away: number };
  /** 1/2 + 2/1 ("ters donus") sayisi. */
  reversals: number;
  avgGoals: number | null;
}

export function computeStats(rows: MatchRow[]): AnalysisStats {
  const htft = Object.fromEntries(HTFT_ORDER.map((k) => [k, 0])) as Record<HtFtResult, number>;
  const ft = { home: 0, draw: 0, away: 0 };
  let withHt = 0;
  let goals = 0;
  let goalMatches = 0;

  for (const r of rows) {
    if (r.ft_home != null && r.ft_away != null) {
      if (r.ft_home > r.ft_away) ft.home++;
      else if (r.ft_home < r.ft_away) ft.away++;
      else ft.draw++;
      const g = r.ft_home + r.ft_away;
      goals += g;
      goalMatches++;
    }
    const outcome = getHtFtOutcome(
      { home: r.ht_home, away: r.ht_away },
      { home: r.ft_home, away: r.ft_away },
    );
    if (outcome) {
      htft[outcome]++;
      withHt++;
    }
  }

  return {
    total: rows.length,
    withHt,
    htft,
    ft,
    reversals: htft['1/2'] + htft['2/1'],
    avgGoals: goalMatches > 0 ? goals / goalMatches : null,
  };
}
