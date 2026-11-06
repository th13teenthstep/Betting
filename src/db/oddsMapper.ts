import type { FixtureOdds, FixtureOddsValue } from '../types/football';
import type { TsaMatchOdds, TsaOddsSide } from '../types/thestatsapi';

function parseOran(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toOddsValue(side: TsaOddsSide | undefined): FixtureOddsValue {
  return {
    opening: parseOran(side?.opening),
    closing: parseOran(side?.last_seen),
  };
}

/** Oran yanitindan SADECE Bet365'i secip FixtureOdds'a cevirir. */
export function extractBet365Odds(odds: TsaMatchOdds | null): FixtureOdds | null {
  if (!odds) return null;

  const bet365 = odds.bookmakers.find(
    (b) => b.bookmaker?.toLowerCase() === 'bet365',
  );
  if (!bet365) return null;

  const matchOdds = bet365.markets.match_odds;
  if (!matchOdds) return null;

  const total25 = bet365.markets.total_goals?.['2.5'];

  return {
    home: toOddsValue(matchOdds.home),
    draw: toOddsValue(matchOdds.draw),
    away: toOddsValue(matchOdds.away),
    over25: toOddsValue(total25?.over),
    under25: toOddsValue(total25?.under),
  };
}
