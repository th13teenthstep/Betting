// ---------------------------------------------------------------------------
// Country / League Hierarchy
// ---------------------------------------------------------------------------

/** A league available under a country. */
export interface League {
  id: number;
  name: string;
  /** Short code, e.g. "PD" for La Liga */
  code: string | null;
  /** API-Football country name – kept here for convenience when drilling down */
  country: string;
  /** Logo URL from the API */
  logo: string;
}

/** A country grouping one or more popular leagues. */
export interface Country {
  name: string;
  code: string; // ISO-2, e.g. "ES", "DE" – handy for flags
  flag: string; // emoji or URL
  leagues: League[];
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

/** Season-stat sub-object returned by API-Football v3 for all/home/away. */
export interface StandingStats {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: {
    for: number;
    against: number;
  };
}

/** One row in a league table — matches API-Football v3 standings structure. */
export interface Standing {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  goalsDiff: number;
  /** "same" | "up" | "down" – describes the team's form group position. */
  group: string | null;
  form: string | null; // e.g. "WWDLW"
  /** Description of the standing, e.g. "Promotion - Champions League" */
  description: string | null;
  /** Overall (all matches) stats. */
  all: StandingStats;
  /** Home matches only. */
  home: StandingStats;
  /** Away matches only. */
  away: StandingStats;
}

/** Full standings response for a league + season. */
export interface LeagueStandings {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
  };
  standings: Standing[][]; // first inner array = "all" group; subsequent = "home"/"away"
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export interface FixtureTeam {
  id: number;
  name: string;
  logo: string;
  winner: boolean | null;
}

export interface FixtureScore {
  home: number | null;
  away: number | null;
}

export interface FixtureStatus {
  long: string;
  short: string;
  elapsed: number | null;
}

/** A single fixture / match. */
export interface Fixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string; // ISO 8601
    venue: {
      id: number | null;
      name: string | null;
      city: string | null;
    };
    status: FixtureStatus;
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: FixtureTeam;
    away: FixtureTeam;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: FixtureScore;
    fulltime: FixtureScore;
    extratime: FixtureScore | null;
    penalty: FixtureScore | null;
  };
  /** Computed client-side — the HT/FT outcome string, e.g. "1/2", "X/1". */
  htFtResult?: HtFtResult | null;
  /** Bet365 1-X-2 ve 2.5 Ust/Alt oranlari — veri yoksa undefined/null. */
  odds?: FixtureOdds | null;
}

// ---------------------------------------------------------------------------
// Odds (Bet365)
// ---------------------------------------------------------------------------

export interface FixtureOddsValue {
  opening: number | null;
  closing: number | null;
}

export interface FixtureOdds {
  home: FixtureOddsValue; // "1"
  draw: FixtureOddsValue; // "X"
  away: FixtureOddsValue; // "2"
  over25: FixtureOddsValue; // Ust 2.5
  under25: FixtureOddsValue; // Alt 2.5
}

// ---------------------------------------------------------------------------
// HT/FT Result Filter
// ---------------------------------------------------------------------------

/**
 * All possible HT/FT outcome combinations.
 *   "1" = home leading, "X" = draw, "2" = away leading.
 */
export type HtFtResult =
  | '1/1'
  | '1/X'
  | '1/2'
  | 'X/1'
  | 'X/X'
  | 'X/2'
  | '2/1'
  | '2/X'
  | '2/2';

export const HTFT_FILTERS: readonly (HtFtResult | 'ALL')[] = [
  'ALL',
  '1/1',
  '1/X',
  '1/2',
  'X/1',
  'X/X',
  'X/2',
  '2/1',
  '2/X',
  '2/2',
] as const;

export type HtFtFilter = (typeof HTFT_FILTERS)[number];

// ---------------------------------------------------------------------------
// Navigation Param List
// ---------------------------------------------------------------------------

export type AnalizStackParamList = {
  AnalizHome: undefined;
  AnalizTeams: { leagueId: number; leagueName: string };
  AnalizDetail: {
    leagueId: number;
    leagueName: string;
    teamName: string;
    /** Takimin siradaki (en fazla 2) maci. */
    fixtures: import('../services/analysisApi').UpcomingFixture[];
  };
};

export type MainTabParamList = {
  Ulkeler: undefined;
  HaftaIstatistikleri: undefined;
  Analiz: undefined;
  Arayis: undefined;
};

export type RootStackParamList = {
  Home: undefined; // alt sekmeli ana yapi (MainTabs)
  LeagueDetail: {
    leagueId: number;
    season: number;
    leagueName: string;
  };
  TakimMaclari: {
    leagueId: number;
    season: number;
    takimId: number;
    takimAdi: string;
  };
};