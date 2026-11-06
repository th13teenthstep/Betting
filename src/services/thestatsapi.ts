import axios from 'axios';
import type {
  TsaCompetition,
  TsaMatch,
  TsaMatchDetail,
  TsaMatchOdds,
  TsaPaginated,
  TsaSeason,
  TsaStandingRow,
} from '../types/thestatsapi';

const BASE_URL = 'https://api.thestatsapi.com/api';

function getApiKey(): string | undefined {
  try {
    // Expo only inlines EXPO_PUBLIC_* vars into the client bundle at build time.
    return (
      process.env.EXPO_PUBLIC_THESTATSAPI_KEY ?? process.env.THESTATSAPI_KEY
    );
  } catch {
    return undefined;
  }
}

const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use((config) => {
  const apiKey = getApiKey();
  if (apiKey) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${apiKey}`;
  }
  return config;
});

function logApiError(context: string, error: unknown): void {
  if (axios.isAxiosError(error)) {
    const code = error.response?.data?.error?.code ?? error.response?.status;
    console.warn(`[TheStatsAPI] ${context} hatasi: ${code} – ${error.message}`);
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[TheStatsAPI] ${context} hatasi: ${message}`);
  }
}

/**
 * Hatayi YUTMAYAN genel GET (kullaniciya sebebi gostermek isteyen ekranlar icin).
 * 429 (dakikada 12 istek siniri) alirsa Retry-After kadar bekleyip en fazla 2 kez tekrar dener.
 */
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await client.get<T>(url, { params });
      return response.data;
    } catch (error) {
      if (attempt < 2 && axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = Number(error.response.headers['retry-after']) || 6;
        await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 30) * 1000));
        continue;
      }
      throw error;
    }
  }
}

/** Ekranda gosterilecek kisa hata aciklamasi. */
export function describeApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'İnternet bağlantısı yok ya da sunucuya ulaşılamadı.';
    const status = error.response.status;
    if (status === 401 || status === 403) {
      return `API anahtarı geçersiz ya da yetkisiz (HTTP ${status}).`;
    }
    if (status === 429) return 'API istek sınırına takıldı, biraz bekleyip tekrar deneyin.';
    return `API hatası (HTTP ${status}).`;
  }
  return error instanceof Error ? error.message : String(error);
}

export async function fetchCompetitions(params?: {
  country?: string;
  type?: 'league' | 'cup' | 'tournament';
  search?: string;
}): Promise<TsaCompetition[]> {
  try {
    const response = await client.get<TsaPaginated<TsaCompetition>>(
      '/football/competitions',
      { params },
    );
    return response.data.data;
  } catch (error) {
    logApiError('competitions', error);
    return [];
  }
}

export async function fetchSeasons(competitionId: string): Promise<TsaSeason[]> {
  try {
    const response = await client.get<TsaPaginated<TsaSeason>>(
      `/football/competitions/${competitionId}/seasons`,
    );
    return response.data.data;
  } catch (error) {
    logApiError('seasons', error);
    return [];
  }
}

export async function fetchStandings(
  competitionId: string,
  seasonId: string,
): Promise<TsaStandingRow[]> {
  try {
    const response = await client.get<{ data: TsaStandingRow[] }>(
      `/football/competitions/${competitionId}/seasons/${seasonId}/standings`,
    );
    return response.data.data;
  } catch (error) {
    logApiError('standings', error);
    return [];
  }
}

export interface FetchMatchesParams {
  competitionId?: string;
  seasonId?: string;
  teamId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  status?: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  matchday?: number;
  page?: number;
  perPage?: number;
  sort?: '-utc_date' | 'utc_date';
}

export async function fetchMatches(
  params: FetchMatchesParams = {},
): Promise<TsaMatch[]> {
  try {
    const response = await client.get<TsaPaginated<TsaMatch>>('/football/matches', {
      params: {
        competition_id: params.competitionId,
        season_id: params.seasonId,
        team_id: params.teamId,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        status: params.status,
        matchday: params.matchday,
        page: params.page,
        per_page: params.perPage,
        sort: params.sort,
      },
    });
    return response.data.data;
  } catch (error) {
    logApiError('matches', error);
    return [];
  }
}

/**
 * Liste endpoinden farkli olarak devre arasi (IY) skorunu icerir.
 * 404 = bu mac icin gercekten veri yok (kalici, tekrar denemeye gerek yok).
 * Diger hatalar (ag kopmasi, 429, 5xx gibi gecici olanlar) FIRLATILIR; cagiran
 * (syncEngine) bunu "veri yok" ile karistirmasin, kuyrukta tekrar denesin.
 */
export async function fetchMatchDetail(matchId: string): Promise<TsaMatchDetail | null> {
  try {
    const data = await apiGet<{ data: TsaMatchDetail }>(`/football/matches/${matchId}`);
    return data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    logApiError('match detail', error);
    throw error;
  }
}

/** fetchMatchDetail ile ayni kurallar (404 = gercekten yok, digerleri gecici hata olarak firlatilir). */
export async function fetchMatchOdds(matchId: string): Promise<TsaMatchOdds | null> {
  try {
    const data = await apiGet<{ data: TsaMatchOdds }>(`/football/matches/${matchId}/odds`);
    return data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    logApiError('match odds', error);
    throw error;
  }
}
