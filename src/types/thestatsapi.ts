// ---------------------------------------------------------------------------
// TheStatsAPI — response types
// Alanlar gercek API yanitlarina bakilarak dogrulandi (openapi.json'daki
// otomatik ozetler bazi alan adlarini yanlis vermisti, bu yuzden
// curl/axios ile canli yanitlar kontrol edildi).
// ---------------------------------------------------------------------------

export type MatchStatus =
  | 'scheduled'
  | 'live'
  | 'finished'
  | 'postponed'
  | 'cancelled';

export interface TsaCompetition {
  id: string; // "comp_*"
  name: string;
  country: string | null;
  country_code: string | null;
  type: 'league' | 'cup' | 'tournament';
}

export interface TsaSeason {
  id: string; // "sn_*"
  name: string; // orn. "LaLiga 25/26"
  year: string; // orn. "25/26"
  start_year: number;
  end_year: number;
  is_current: boolean;
}

export interface TsaTeamRef {
  id: string; // "tm_*"
  name: string;
}

export interface TsaMatchScore {
  home: number | null;
  away: number | null;
  regulation: { home: number; away: number } | null;
  winner: 'home' | 'away' | 'draw' | null;
  // Sadece /football/matches/{id} (detay) yanitinda gelir, liste endpoint'inde yok.
  half_time_home?: number | null;
  half_time_away?: number | null;
}

export interface TsaMatch {
  id: string; // "mt_*"
  competition_id: string;
  season_id: string;
  utc_date: string; // ISO 8601
  status: MatchStatus;
  matchday: number | null;
  stage: 'regular' | 'playoff';
  home_team: TsaTeamRef;
  away_team: TsaTeamRef;
  score: TsaMatchScore;
}

/** GET /football/matches/{id} — liste yanitina ek olarak venue/referee/IY skoru icerir. */
export interface TsaMatchDetail extends TsaMatch {
  venue: { name: string | null; city: string | null } | null;
  referee: { id: string; name: string } | null;
}

export interface TsaStandingRow {
  position: number;
  team: TsaTeamRef;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  group_label: string | null;
}

/** Oran degeri: aci-ci-kapanis string olarak gelir, orn. "1.800". */
export interface TsaOddsSide {
  opening: string | null;
  last_seen: string | null;
}

export interface TsaMatchOddsMarkets {
  match_odds?: { home: TsaOddsSide; draw: TsaOddsSide; away: TsaOddsSide };
  total_goals?: Record<string, { over: TsaOddsSide; under: TsaOddsSide }>;
  // btts, match_corners, total_cards, asian_handicap, draw_no_bet,
  // double_chance, first_half_result, first_team_to_score de geliyor
  // ama su an kullanilmiyor.
  [key: string]: unknown;
}

export interface TsaBookmaker {
  bookmaker: string; // "Bet365" | "Paddy Power" | "BetMGM UK" | "Pinnacle" | "Betfair Exchange"
  markets: TsaMatchOddsMarkets;
}

export interface TsaMatchOdds {
  match_id: string;
  bookmakers: TsaBookmaker[];
}

/** Generic paginated list envelope used by most TheStatsAPI list endpoints. */
export interface TsaPaginated<T> {
  data: T[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface TsaErrorEnvelope {
  error: {
    code:
      | 'BAD_REQUEST'
      | 'UNAUTHORIZED'
      | 'NOT_FOUND'
      | 'RATE_LIMITED'
      | 'USAGE_LIMIT_EXCEEDED'
      | string;
    message: string;
  };
}
