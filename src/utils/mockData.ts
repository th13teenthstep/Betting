import type {
  Country,
  LeagueStandings,
  Fixture,
} from '../types/football';

// ---------------------------------------------------------------------------
// Countries & Leagues
// ---------------------------------------------------------------------------

export const MOCK_COUNTRIES: Country[] = [
  {
    name: 'Avrupa Kupaları',
    code: 'UEFA',
    flag: '🇪🇺',
    leagues: [
      { id: 9021, name: 'Şampiyonlar Ligi', code: 'UCL', country: 'Europe', logo: '' },
      { id: 9022, name: 'Avrupa Ligi', code: 'UEL', country: 'Europe', logo: '' },
      { id: 9023, name: 'Konferans Ligi', code: 'UECL', country: 'Europe', logo: '' },
      { id: 9024, name: 'UEFA Süper Kupa', code: 'USC', country: 'Europe', logo: '' },
    ],
  },
  {
    name: 'Ingiltere',
    code: 'GB',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    leagues: [
      {
        id: 39,
        name: 'Premier League',
        code: 'PL',
        country: 'England',
        logo: 'https://media.api-sports.io/football/leagues/39.png',
      },
      {
        id: 40,
        name: 'Championship',
        code: 'ELC',
        country: 'England',
        logo: 'https://media.api-sports.io/football/leagues/40.png',
      },
      {
        id: 9001,
        name: 'League One',
        code: 'EL1',
        country: 'England',
        logo: '',
      },
      {
        id: 9002,
        name: 'League Two',
        code: 'EL2',
        country: 'England',
        logo: '',
      },
      {
        id: 9003,
        name: 'National League',
        code: 'ENL',
        country: 'England',
        logo: '',
      },
      { id: 9034, name: 'FA Cup', code: 'FAC', country: 'England', logo: '' },
      { id: 9035, name: 'EFL Cup', code: 'EFLC', country: 'England', logo: '' },
    ],
  },
  {
    name: 'Ispanya',
    code: 'ES',
    flag: '🇪🇸',
    leagues: [
      {
        id: 140,
        name: 'La Liga',
        code: 'PD',
        country: 'Spain',
        logo: 'https://media.api-sports.io/football/leagues/140.png',
      },
      {
        id: 141,
        name: 'Segunda Division',
        code: 'SD',
        country: 'Spain',
        logo: 'https://media.api-sports.io/football/leagues/141.png',
      },
      { id: 9036, name: 'Copa del Rey', code: 'CDR', country: 'Spain', logo: '' },
    ],
  },
  {
    name: 'Italya',
    code: 'IT',
    flag: '🇮🇹',
    leagues: [
      {
        id: 135,
        name: 'Serie A',
        code: 'SA',
        country: 'Italy',
        logo: 'https://media.api-sports.io/football/leagues/135.png',
      },
      {
        id: 9008,
        name: 'Serie B',
        code: 'SB',
        country: 'Italy',
        logo: '',
      },
      { id: 9038, name: 'Coppa Italia', code: 'CIT', country: 'Italy', logo: '' },
    ],
  },
  {
    name: 'Almanya',
    code: 'DE',
    flag: '🇩🇪',
    leagues: [
      {
        id: 78,
        name: 'Bundesliga',
        code: 'BL1',
        country: 'Germany',
        logo: 'https://media.api-sports.io/football/leagues/78.png',
      },
      {
        id: 79,
        name: '2. Bundesliga',
        code: 'BL2',
        country: 'Germany',
        logo: 'https://media.api-sports.io/football/leagues/79.png',
      },
      { id: 9037, name: 'DFB Pokal', code: 'DFB', country: 'Germany', logo: '' },
    ],
  },
  {
    name: 'Fransa',
    code: 'FR',
    flag: '🇫🇷',
    leagues: [
      {
        id: 61,
        name: 'Ligue 1',
        code: 'FL1',
        country: 'France',
        logo: 'https://media.api-sports.io/football/leagues/61.png',
      },
      {
        id: 9009,
        name: 'Ligue 2',
        code: 'FL2',
        country: 'France',
        logo: '',
      },
      { id: 9039, name: 'Coupe de France', code: 'CDF', country: 'France', logo: '' },
    ],
  },
  {
    name: 'Milli Takım Turnuvaları',
    code: 'NAT',
    flag: '🌍',
    leagues: [
      { id: 9025, name: 'FIFA Dünya Kupası', code: 'WC', country: 'World', logo: '' },
      { id: 9026, name: 'EURO', code: 'EURO', country: 'Europe', logo: '' },
      { id: 9027, name: 'Copa América', code: 'CA', country: 'South America', logo: '' },
      { id: 9028, name: 'Africa Cup of Nations', code: 'AFCON', country: 'Africa', logo: '' },
      { id: 9029, name: 'CONCACAF Gold Cup', code: 'GC', country: 'North America', logo: '' },
    ],
  },
  {
    name: 'Hollanda',
    code: 'NL',
    flag: '🇳🇱',
    leagues: [
      {
        id: 88,
        name: 'Eredivisie',
        code: 'ED',
        country: 'Netherlands',
        logo: 'https://media.api-sports.io/football/leagues/88.png',
      },
      {
        id: 89,
        name: 'Eerste Divisie',
        code: 'ED2',
        country: 'Netherlands',
        logo: 'https://media.api-sports.io/football/leagues/89.png',
      },
    ],
  },
  {
    name: 'Portekiz',
    code: 'PT',
    flag: '🇵🇹',
    leagues: [
      {
        id: 94,
        name: 'Primeira Liga',
        code: 'PPL',
        country: 'Portugal',
        logo: 'https://media.api-sports.io/football/leagues/94.png',
      },
      { id: 9041, name: 'Liga Portugal 2', code: 'LP2', country: 'Portugal', logo: '' },
      { id: 9040, name: 'Taça de Portugal', code: 'TDP', country: 'Portugal', logo: '' },
    ],
  },
  {
    name: 'Belcika',
    code: 'BE',
    flag: '🇧🇪',
    leagues: [
      {
        id: 9010,
        name: 'Jupiler Pro League',
        code: 'JPL',
        country: 'Belgium',
        logo: '',
      },
    ],
  },
  {
    name: 'Turkiye',
    code: 'TR',
    flag: '🇹🇷',
    leagues: [
      {
        id: 203,
        name: 'Super Lig',
        code: 'SL',
        country: 'Turkey',
        logo: 'https://media.api-sports.io/football/leagues/203.png',
      },
    ],
  },
  {
    name: 'Yunanistan',
    code: 'GR',
    flag: '🇬🇷',
    leagues: [
      {
        id: 9011,
        name: 'Super League Greece',
        code: 'SLG',
        country: 'Greece',
        logo: '',
      },
    ],
  },
  {
    name: 'Iskocya',
    code: 'SCO',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    leagues: [
      {
        id: 9004,
        name: 'Scottish Premiership',
        code: 'SPR',
        country: 'Scotland',
        logo: '',
      },
      {
        id: 9005,
        name: 'Scottish Championship',
        code: 'SCH',
        country: 'Scotland',
        logo: '',
      },
      {
        id: 9006,
        name: 'Scottish League One',
        code: 'SL1',
        country: 'Scotland',
        logo: '',
      },
      {
        id: 9007,
        name: 'Scottish League Two',
        code: 'SL2',
        country: 'Scotland',
        logo: '',
      },
    ],
  },
  {
    name: 'Avusturya',
    code: 'AT',
    flag: '🇦🇹',
    leagues: [
      { id: 9042, name: 'Austrian Bundesliga', code: 'AUT1', country: 'Austria', logo: '' },
    ],
  },
  {
    name: 'Rusya',
    code: 'RU',
    flag: '🇷🇺',
    leagues: [
      { id: 9043, name: 'Russian Premier League', code: 'RPL', country: 'Russia', logo: '' },
    ],
  },
  {
    name: 'Polonya',
    code: 'PL',
    flag: '🇵🇱',
    leagues: [
      { id: 9046, name: 'Ekstraklasa', code: 'EKS', country: 'Poland', logo: '' },
    ],
  },
  {
    name: 'Hirvatistan',
    code: 'HR',
    flag: '🇭🇷',
    leagues: [
      { id: 9047, name: 'HNL', code: 'HNL', country: 'Croatia', logo: '' },
    ],
  },
  {
    name: 'Ukrayna',
    code: 'UA',
    flag: '🇺🇦',
    leagues: [
      { id: 9048, name: 'Ukrainian Premier League', code: 'UPL', country: 'Ukraine', logo: '' },
    ],
  },
  {
    name: 'Cekya',
    code: 'CZ',
    flag: '🇨🇿',
    leagues: [
      { id: 9049, name: 'Czech First League', code: 'CFL', country: 'Czech Republic', logo: '' },
    ],
  },
  {
    name: 'Israil',
    code: 'IL',
    flag: '🇮🇱',
    leagues: [
      { id: 9050, name: 'Israeli Premier League', code: 'IPL', country: 'Israel', logo: '' },
    ],
  },
  {
    name: 'Kıtalar Arası Kulüp Kupaları',
    code: 'CONF',
    flag: '🌐',
    leagues: [
      { id: 9030, name: 'CONMEBOL Libertadores', code: 'LIB', country: 'South America', logo: '' },
      { id: 9031, name: 'CONMEBOL Sudamericana', code: 'SUD', country: 'South America', logo: '' },
      { id: 9032, name: 'AFC Champions League Elite', code: 'ACL', country: 'Asia', logo: '' },
      { id: 9033, name: 'CAF Champions League', code: 'CAFCL', country: 'Africa', logo: '' },
    ],
  },
  {
    name: 'Arjantin',
    code: 'AR',
    flag: '🇦🇷',
    leagues: [
      {
        id: 9012,
        name: 'Liga Profesional',
        code: 'ARG1',
        country: 'Argentina',
        logo: '',
      },
    ],
  },
  {
    name: 'Brezilya',
    code: 'BR',
    flag: '🇧🇷',
    leagues: [
      {
        id: 9013,
        name: 'Brasileirão Série A',
        code: 'BRA1',
        country: 'Brazil',
        logo: '',
      },
    ],
  },
  {
    name: 'ABD',
    code: 'US',
    flag: '🇺🇸',
    leagues: [
      {
        id: 9020,
        name: 'MLS',
        code: 'MLS',
        country: 'USA',
        logo: '',
      },
    ],
  },
  {
    name: 'Meksika',
    code: 'MX',
    flag: '🇲🇽',
    leagues: [
      { id: 9045, name: 'Liga MX', code: 'LMX', country: 'Mexico', logo: '' },
    ],
  },
  {
    name: 'Cin',
    code: 'CN',
    flag: '🇨🇳',
    leagues: [
      {
        id: 9014,
        name: 'Chinese Super League',
        code: 'CSL',
        country: 'China',
        logo: '',
      },
    ],
  },
  {
    name: 'Japonya',
    code: 'JP',
    flag: '🇯🇵',
    leagues: [
      {
        id: 9016,
        name: 'J1 League',
        code: 'J1',
        country: 'Japan',
        logo: '',
      },
    ],
  },
  {
    name: 'Norvec',
    code: 'NO',
    flag: '🇳🇴',
    leagues: [
      {
        id: 9017,
        name: 'Eliteserien',
        code: 'NOR1',
        country: 'Norway',
        logo: '',
      },
    ],
  },
  {
    name: 'Isvec',
    code: 'SE',
    flag: '🇸🇪',
    leagues: [
      {
        id: 9018,
        name: 'Allsvenskan',
        code: 'SWE1',
        country: 'Sweden',
        logo: '',
      },
    ],
  },
  {
    name: 'Isvicre',
    code: 'CH',
    flag: '🇨🇭',
    leagues: [
      {
        id: 9019,
        name: 'Swiss Super League',
        code: 'SWZ1',
        country: 'Switzerland',
        logo: '',
      },
    ],
  },
  {
    name: 'Danimarka',
    code: 'DK',
    flag: '🇩🇰',
    leagues: [
      {
        id: 9015,
        name: 'Danish Superliga',
        code: 'DNK1',
        country: 'Denmark',
        logo: '',
      },
    ],
  },
  {
    name: 'Guney Kore',
    code: 'KR',
    flag: '🇰🇷',
    leagues: [
      { id: 9051, name: 'K League 1', code: 'K1', country: 'South Korea', logo: '' },
    ],
  },
  {
    name: 'Suudi Arabistan',
    code: 'SA',
    flag: '🇸🇦',
    leagues: [
      { id: 9044, name: 'Saudi Pro League', code: 'SPL', country: 'Saudi Arabia', logo: '' },
    ],
  },
  {
    name: 'Katar',
    code: 'QA',
    flag: '🇶🇦',
    leagues: [
      { id: 9052, name: 'Qatar Stars League', code: 'QSL', country: 'Qatar', logo: '' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Standings (La Liga 2024)
// ---------------------------------------------------------------------------

// Helper: oluşturmak için shorthand
function stats(w: number, d: number, l: number, gf: number, ga: number) {
  return { played: w + d + l, win: w, draw: d, lose: l, goals: { for: gf, against: ga } };
}

export const MOCK_STANDINGS: LeagueStandings = {
  league: {
    id: 140,
    name: 'La Liga',
    country: 'Spain',
    logo: 'https://media.api-sports.io/football/leagues/140.png',
    flag: '🇪🇸',
    season: 2024,
  },
  standings: [
    [
      {
        rank: 1,
        team: { id: 541, name: 'Real Madrid', logo: 'https://media.api-sports.io/football/teams/541.png' },
        points: 87, goalsDiff: 42, group: 'same', form: 'WWDLW',
        description: 'Promotion - Champions League',
        all: stats(27, 6, 5, 79, 37),
        home: stats(14, 3, 2, 43, 15),
        away: stats(13, 3, 3, 36, 22),
      },
      {
        rank: 2,
        team: { id: 529, name: 'FC Barcelona', logo: 'https://media.api-sports.io/football/teams/529.png' },
        points: 82, goalsDiff: 35, group: 'up', form: 'WWWLW',
        description: 'Promotion - Champions League',
        all: stats(25, 7, 6, 76, 41),
        home: stats(14, 3, 2, 41, 18),
        away: stats(11, 4, 4, 35, 23),
      },
      {
        rank: 3,
        team: { id: 530, name: 'Atlético Madrid', logo: 'https://media.api-sports.io/football/teams/530.png' },
        points: 73, goalsDiff: 25, group: 'down', form: 'LWWDL',
        description: 'Promotion - Champions League',
        all: stats(22, 7, 9, 65, 40),
        home: stats(14, 3, 2, 38, 15),
        away: stats(8, 4, 7, 27, 25),
      },
      {
        rank: 4,
        team: { id: 547, name: 'Girona', logo: 'https://media.api-sports.io/football/teams/547.png' },
        points: 68, goalsDiff: 18, group: 'up', form: 'DWLWW',
        description: 'Promotion - Champions League',
        all: stats(20, 8, 10, 62, 44),
        home: stats(13, 4, 2, 36, 16),
        away: stats(7, 4, 8, 26, 28),
      },
      {
        rank: 5,
        team: { id: 531, name: 'Athletic Club', logo: 'https://media.api-sports.io/football/teams/531.png' },
        points: 64, goalsDiff: 12, group: 'same', form: 'WDWLL',
        description: 'Promotion - Europa League',
        all: stats(18, 10, 10, 55, 43),
        home: stats(11, 5, 3, 32, 16),
        away: stats(7, 5, 7, 23, 27),
      },
      {
        rank: 6,
        team: { id: 548, name: 'Real Sociedad', logo: 'https://media.api-sports.io/football/teams/548.png' },
        points: 60, goalsDiff: 8, group: 'down', form: 'WLWDL',
        description: 'Promotion - Europa Conference League',
        all: stats(16, 12, 10, 50, 42),
        home: stats(9, 7, 3, 28, 18),
        away: stats(7, 5, 7, 22, 24),
      },
      {
        rank: 7,
        team: { id: 533, name: 'Real Betis', logo: 'https://media.api-sports.io/football/teams/533.png' },
        points: 56, goalsDiff: 3, group: 'up', form: 'DWDLW',
        description: null,
        all: stats(14, 14, 10, 48, 45),
        home: stats(9, 7, 3, 27, 18),
        away: stats(5, 7, 7, 21, 27),
      },
      {
        rank: 8,
        team: { id: 534, name: 'Villarreal', logo: 'https://media.api-sports.io/football/teams/534.png' },
        points: 53, goalsDiff: -2, group: 'same', form: 'WDLLW',
        description: null,
        all: stats(14, 11, 13, 52, 54),
        home: stats(8, 5, 6, 29, 24),
        away: stats(6, 6, 7, 23, 30),
      },
    ],
  ],
};

// ---------------------------------------------------------------------------
// Fixtures (with varied HT/FT outcomes)
// ---------------------------------------------------------------------------

export const MOCK_FIXTURES: Fixture[] = [
  {
    fixture: {
      id: 1185200,
      referee: 'J. Sánchez',
      timezone: 'Europe/Madrid',
      date: '2024-05-26T21:00:00+02:00',
      venue: { id: 1456, name: 'Estadio Santiago Bernabéu', city: 'Madrid' },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: {
      id: 140,
      name: 'La Liga',
      country: 'Spain',
      logo: 'https://media.api-sports.io/football/leagues/140.png',
      flag: '🇪🇸',
      season: 2024,
      round: 'Regular Season - 38',
    },
    teams: {
      home: {
        id: 541,
        name: 'Real Madrid',
        logo: 'https://media.api-sports.io/football/teams/541.png',
        winner: true,
      },
      away: {
        id: 529,
        name: 'FC Barcelona',
        logo: 'https://media.api-sports.io/football/teams/529.png',
        winner: false,
      },
    },
    goals: { home: 3, away: 2 },
    score: {
      halftime: { home: 2, away: 0 },
      fulltime: { home: 3, away: 2 },
      extratime: null,
      penalty: null,
    },
  },
  {
    fixture: {
      id: 1185201,
      referee: 'A. Hernández',
      timezone: 'Europe/Madrid',
      date: '2024-05-25T18:30:00+02:00',
      venue: { id: 19217, name: 'Estadio Metropolitano', city: 'Madrid' },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: {
      id: 140,
      name: 'La Liga',
      country: 'Spain',
      logo: 'https://media.api-sports.io/football/leagues/140.png',
      flag: '🇪🇸',
      season: 2024,
      round: 'Regular Season - 38',
    },
    teams: {
      home: {
        id: 530,
        name: 'Atlético Madrid',
        logo: 'https://media.api-sports.io/football/teams/530.png',
        winner: false,
      },
      away: {
        id: 548,
        name: 'Real Sociedad',
        logo: 'https://media.api-sports.io/football/teams/548.png',
        winner: false,
      },
    },
    goals: { home: 1, away: 1 },
    score: {
      halftime: { home: 0, away: 0 },
      fulltime: { home: 1, away: 1 },
      extratime: null,
      penalty: null,
    },
  },
  {
    fixture: {
      id: 1185202,
      referee: 'C. Del Cerro',
      timezone: 'Europe/Madrid',
      date: '2024-05-25T16:15:00+02:00',
      venue: { id: 1491, name: 'Estadio San Mamés', city: 'Bilbao' },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: {
      id: 140,
      name: 'La Liga',
      country: 'Spain',
      logo: 'https://media.api-sports.io/football/leagues/140.png',
      flag: '🇪🇸',
      season: 2024,
      round: 'Regular Season - 38',
    },
    teams: {
      home: {
        id: 531,
        name: 'Athletic Club',
        logo: 'https://media.api-sports.io/football/teams/531.png',
        winner: true,
      },
      away: {
        id: 534,
        name: 'Villarreal',
        logo: 'https://media.api-sports.io/football/teams/534.png',
        winner: false,
      },
    },
    goals: { home: 2, away: 0 },
    score: {
      halftime: { home: 1, away: 0 },
      fulltime: { home: 2, away: 0 },
      extratime: null,
      penalty: null,
    },
  },
  {
    fixture: {
      id: 1185203,
      referee: 'M. Melero',
      timezone: 'Europe/Madrid',
      date: '2024-05-25T14:00:00+02:00',
      venue: {
        id: 1497,
        name: 'Estadio Benito Villamarín',
        city: 'Sevilla',
      },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: {
      id: 140,
      name: 'La Liga',
      country: 'Spain',
      logo: 'https://media.api-sports.io/football/leagues/140.png',
      flag: '🇪🇸',
      season: 2024,
      round: 'Regular Season - 38',
    },
    teams: {
      home: {
        id: 533,
        name: 'Real Betis',
        logo: 'https://media.api-sports.io/football/teams/533.png',
        winner: true,
      },
      away: {
        id: 547,
        name: 'Girona',
        logo: 'https://media.api-sports.io/football/teams/547.png',
        winner: false,
      },
    },
    goals: { home: 2, away: 1 },
    score: {
      halftime: { home: 0, away: 1 },
      fulltime: { home: 2, away: 1 },
      extratime: null,
      penalty: null,
    },
  },
  {
    fixture: {
      id: 1185204,
      referee: 'P. González',
      timezone: 'Europe/Madrid',
      date: '2024-05-24T21:00:00+02:00',
      venue: { id: 1494, name: 'Estadio Ramón Sánchez Pizjuán', city: 'Sevilla' },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: {
      id: 140,
      name: 'La Liga',
      country: 'Spain',
      logo: 'https://media.api-sports.io/football/leagues/140.png',
      flag: '🇪🇸',
      season: 2024,
      round: 'Regular Season - 37',
    },
    teams: {
      home: {
        id: 536,
        name: 'Sevilla',
        logo: 'https://media.api-sports.io/football/teams/536.png',
        winner: false,
      },
      away: {
        id: 541,
        name: 'Real Madrid',
        logo: 'https://media.api-sports.io/football/teams/541.png',
        winner: true,
      },
    },
    goals: { home: 1, away: 4 },
    score: {
      halftime: { home: 1, away: 2 },
      fulltime: { home: 1, away: 4 },
      extratime: null,
      penalty: null,
    },
  },
  {
    fixture: {
      id: 1185205,
      referee: 'J. Munuera',
      timezone: 'Europe/Madrid',
      date: '2024-05-24T19:30:00+02:00',
      venue: { id: 1492, name: 'Estadio de Mestalla', city: 'Valencia' },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: {
      id: 140,
      name: 'La Liga',
      country: 'Spain',
      logo: 'https://media.api-sports.io/football/leagues/140.png',
      flag: '🇪🇸',
      season: 2024,
      round: 'Regular Season - 37',
    },
    teams: {
      home: {
        id: 532,
        name: 'Valencia',
        logo: 'https://media.api-sports.io/football/teams/532.png',
        winner: true,
      },
      away: {
        id: 530,
        name: 'Atlético Madrid',
        logo: 'https://media.api-sports.io/football/teams/530.png',
        winner: false,
      },
    },
    goals: { home: 2, away: 1 },
    score: {
      halftime: { home: 1, away: 1 },
      fulltime: { home: 2, away: 1 },
      extratime: null,
      penalty: null,
    },
  },
  {
    fixture: {
      id: 1185206,
      referee: 'G. Cuadra',
      timezone: 'Europe/Madrid',
      date: '2024-05-23T21:30:00+02:00',
      venue: { id: 8560, name: 'Estadio Municipal de Montilivi', city: 'Girona' },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: {
      id: 140,
      name: 'La Liga',
      country: 'Spain',
      logo: 'https://media.api-sports.io/football/leagues/140.png',
      flag: '🇪🇸',
      season: 2024,
      round: 'Regular Season - 36',
    },
    teams: {
      home: {
        id: 547,
        name: 'Girona',
        logo: 'https://media.api-sports.io/football/teams/547.png',
        winner: false,
      },
      away: {
        id: 529,
        name: 'FC Barcelona',
        logo: 'https://media.api-sports.io/football/teams/529.png',
        winner: true,
      },
    },
    goals: { home: 1, away: 3 },
    score: {
      halftime: { home: 0, away: 2 },
      fulltime: { home: 1, away: 3 },
      extratime: null,
      penalty: null,
    },
  },
  {
    fixture: {
      id: 1185207,
      referee: 'A. Mateu',
      timezone: 'Europe/Madrid',
      date: '2024-05-23T19:00:00+02:00',
      venue: { id: 1489, name: 'Estadio de la Cerámica', city: 'Villarreal' },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: {
      id: 140,
      name: 'La Liga',
      country: 'Spain',
      logo: 'https://media.api-sports.io/football/leagues/140.png',
      flag: '🇪🇸',
      season: 2024,
      round: 'Regular Season - 36',
    },
    teams: {
      home: {
        id: 534,
        name: 'Villarreal',
        logo: 'https://media.api-sports.io/football/teams/534.png',
        winner: false,
      },
      away: {
        id: 531,
        name: 'Athletic Club',
        logo: 'https://media.api-sports.io/football/teams/531.png',
        winner: false,
      },
    },
    goals: { home: 2, away: 2 },
    score: {
      halftime: { home: 1, away: 0 },
      fulltime: { home: 2, away: 2 },
      extratime: null,
      penalty: null,
    },
  },
  {
    fixture: {
      id: 1185208,
      referee: 'R. De Burgos',
      timezone: 'Europe/Madrid',
      date: '2024-05-22T21:00:00+02:00',
      venue: { id: 1497, name: 'Estadio Benito Villamarín', city: 'Sevilla' },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: {
      id: 140,
      name: 'La Liga',
      country: 'Spain',
      logo: 'https://media.api-sports.io/football/leagues/140.png',
      flag: '🇪🇸',
      season: 2024,
      round: 'Regular Season - 35',
    },
    teams: {
      home: {
        id: 533,
        name: 'Real Betis',
        logo: 'https://media.api-sports.io/football/teams/533.png',
        winner: false,
      },
      away: {
        id: 548,
        name: 'Real Sociedad',
        logo: 'https://media.api-sports.io/football/teams/548.png',
        winner: true,
      },
    },
    goals: { home: 0, away: 2 },
    score: {
      halftime: { home: 0, away: 1 },
      fulltime: { home: 0, away: 2 },
      extratime: null,
      penalty: null,
    },
  },
];