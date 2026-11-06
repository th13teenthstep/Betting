import type { MatchRow } from '../db/matchesRepo';
import { rowToFixture } from '../db/matchesRepo';
import type { LeagueFixture } from '../services/fixtureService';
import type { Fixture, FixtureOdds } from '../types/football';
import { hashId } from './hashId';
import { getHtFtOutcome } from './htftCalculator';

export interface LeagueDisplayMeta {
  name: string;
  country: string;
  logo: string;
  flag: string | null;
}

/**
 * API'den gelen bir fiksturu MatchCard'in bekledigi `Fixture` bicimine cevirir.
 *  - Oynanmis ve DB'de bulunan mac: IY/MS + oranlar DB satirindan (API istegi yok).
 *  - Oynanmis ama DB'de yok: sadece API skoru.
 *  - Oynanmamis: skor yok, oranlar API'den (varsa).
 * Takim adlari her durumda API adlari olarak gosterilir.
 */
export function buildCardFixture(args: {
  f: LeagueFixture;
  leagueId: number;
  season: number;
  meta: LeagueDisplayMeta;
  dbRow: MatchRow | null;
  odds: FixtureOdds | null;
  /** DB'de olmayan oynanmis mac icin API'den gelen IY skoru. */
  ht?: { home: number | null; away: number | null } | null;
  homeDbId: string | null;
  awayDbId: string | null;
}): Fixture {
  const { f, leagueId, season, meta, dbRow, odds, ht, homeDbId, awayDbId } = args;

  if (dbRow && f.status === 'finished') {
    const base = rowToFixture(dbRow, meta);
    return {
      ...base,
      teams: {
        home: { ...base.teams.home, name: f.homeName },
        away: { ...base.teams.away, name: f.awayName },
      },
      htFtResult: getHtFtOutcome(base.score.halftime, base.score.fulltime),
    };
  }

  const played = f.status !== 'scheduled';
  const homeScore = played ? f.homeScore : null;
  const awayScore = played ? f.awayScore : null;
  const winner = (side: 'home' | 'away'): boolean | null => {
    if (homeScore == null || awayScore == null || f.status !== 'finished') return null;
    if (homeScore === awayScore) return null;
    return side === 'home' ? homeScore > awayScore : awayScore > homeScore;
  };

  return {
    fixture: {
      id: hashId(f.id),
      referee: null,
      timezone: 'UTC',
      date: f.utcDate,
      venue: { id: null, name: null, city: null },
      status: {
        long: f.status,
        short: f.status === 'finished' ? 'FT' : f.status === 'live' ? 'LIVE' : 'NS',
        elapsed: null,
      },
    },
    league: {
      id: leagueId,
      name: meta.name,
      country: meta.country,
      logo: meta.logo,
      flag: meta.flag,
      season,
      round: f.matchday != null ? `Round ${f.matchday}` : '',
    },
    teams: {
      home: { id: hashId(homeDbId ?? `api:${f.homeName}`), name: f.homeName, logo: '', winner: winner('home') },
      away: { id: hashId(awayDbId ?? `api:${f.awayName}`), name: f.awayName, logo: '', winner: winner('away') },
    },
    goals: { home: homeScore, away: awayScore },
    score: {
      halftime: { home: ht?.home ?? null, away: ht?.away ?? null },
      fulltime: { home: homeScore, away: awayScore },
      extratime: null,
      penalty: null,
    },
    htFtResult:
      f.status === 'finished'
        ? getHtFtOutcome(
            { home: ht?.home ?? null, away: ht?.away ?? null },
            { home: homeScore, away: awayScore },
          )
        : null,
    odds,
  };
}
