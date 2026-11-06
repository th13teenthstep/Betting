import BackgroundTimer from 'react-native-background-timer';
import { fetchMatchDetail, fetchMatchOdds } from '../services/thestatsapi';
import { extractBet365Odds } from './oddsMapper';
import {
  finishQueueItem,
  getNextQueueItem,
  getPendingQueueCount,
  mergeFileOdds,
  updateHt,
  updateOdds,
} from './matchesRepo';

// ---------------------------------------------------------------------------
// Rate limit: TheStatsAPI dakikada 12 istek. Her HTTP cagrisindan once en az
// bu kadar bekleriz (12/dk'nin biraz altinda, ~10.9/dk) — boylece on planda
// kullanicinin tetikledigi diger isteklere de pay kalir.
// ---------------------------------------------------------------------------
const MIN_CALL_GAP_MS = 5500;

export interface SyncProgressState {
  active: boolean;
  total: number;
  remaining: number;
  percent: number;
  etaMinutes: number;
}

function idleState(): SyncProgressState {
  return { active: false, total: 0, remaining: 0, percent: 100, etaMinutes: 0 };
}

let sessionTotal = 0;
let currentRemaining = 0;
let running = false;
let lastCallAt = 0;
let stopRequested = false;

/** Arka plan servisindeki "Durdur" aksiyonundan cagrilir; bir sonraki loop turunda dongu durur. */
export function requestStop(): void {
  stopRequested = true;
}

const listeners = new Set<(state: SyncProgressState) => void>();

function computeState(): SyncProgressState {
  if (!running && currentRemaining === 0) return idleState();

  const total = Math.max(sessionTotal, currentRemaining, 1);
  const done = Math.max(0, total - currentRemaining);
  const percent = Math.min(100, Math.round((done / total) * 100));
  // Kalan her mac en kotu durumda 2 istek (IY + oran) gerektirir.
  const etaMinutes = Math.ceil((currentRemaining * 2 * MIN_CALL_GAP_MS) / 60000);

  return { active: currentRemaining > 0, total, remaining: currentRemaining, percent, etaMinutes };
}

function notify(): void {
  const state = computeState();
  listeners.forEach((l) => l(state));
}

export function subscribeSyncProgress(
  listener: (state: SyncProgressState) => void,
): () => void {
  listeners.add(listener);
  listener(computeState());
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncProgressState(): SyncProgressState {
  return computeState();
}

async function throttle(): Promise<void> {
  const wait = MIN_CALL_GAP_MS - (Date.now() - lastCallAt);
  if (wait > 0) {
    // Duz setTimeout, uygulama arka plana atilinca (ekran kapali/baska uygulama)
    // Android'de calismayi durdurabiliyor; BackgroundTimer bunu RNBA'nin foreground
    // service'i ile birlikte garanti eder.
    await new Promise((resolve) => BackgroundTimer.setTimeout(resolve, wait));
  }
  lastCallAt = Date.now();
}

async function processNext(): Promise<boolean> {
  const item = await getNextQueueItem();
  if (!item) return false;

  let htDone = item.needs_ht === 0;
  let oddsDone = item.needs_odds === 0;
  // Dosya kaynakli maclarda API'yi api_id ile cagiririz, sonucu match_id'ye (DB satirina) yazariz.
  const apiId = item.api_id ?? item.match_id;
  const isFileMatch = item.api_id != null;

  if (item.needs_ht === 1) {
    await throttle();
    try {
      const detail = await fetchMatchDetail(apiId);
      if (detail) {
        await updateHt(
          item.match_id,
          detail.score.half_time_home ?? null,
          detail.score.half_time_away ?? null,
        );
      }
      // Istek basarili oldu (veri olsun ya da olmasin, orn. 404): tekrar denemeye gerek yok.
      htDone = true;
    } catch {
      // Ag kopmasi / 429 / 5xx gibi gecici hata: htDone false kalir, sonraki turda tekrar denenir.
    }
  }

  if (item.needs_odds === 1) {
    await throttle();
    try {
      const odds = await fetchMatchOdds(apiId);
      const bet365 = extractBet365Odds(odds);
      if (isFileMatch) await mergeFileOdds(item.match_id, bet365);
      else await updateOdds(item.match_id, bet365);
      // Bet365 verisi bu mac icin hic yoksa bile (basarili istek, bos veri) "denendi" sayip
      // kuyruktan dusuruyoruz, yoksa sonsuza kadar tekrar denemeye calisirdik. Ama bu SADECE
      // istek basarili olduysa gecerli - asagidaki catch bunu gecici hatalardan ayirir.
      oddsDone = true;
    } catch {
      // Gecici hata: oddsDone false kalir, sonraki turda tekrar denenir.
    }
  }

  await finishQueueItem(item, { htDone, oddsDone });
  return true;
}

async function loop(): Promise<void> {
  let processed: boolean;
  try {
    processed = await processNext();
  } catch (error) {
    // Beklenmeyen hata (orn. DB erisimi): dongu kilitli kalmasin, `running`i dusurup
    // cikiyoruz - bir sonraki ensureDrainRunning cagrisi (ekran acilisi) yeniden baslatir.
    console.warn('[Sync] loop beklenmeyen hata, duraklatiliyor:', error);
    running = false;
    currentRemaining = await getPendingQueueCount();
    notify();
    BackgroundTimer.stop();
    return;
  }

  currentRemaining = await getPendingQueueCount();
  notify();

  if (!processed || currentRemaining === 0 || stopRequested) {
    running = false;
    stopRequested = false;
    sessionTotal = 0;
    currentRemaining = 0;
    notify();
    BackgroundTimer.stop();
    return;
  }

  BackgroundTimer.setTimeout(loop, 10);
}

/** Kuyruk bos degilse arka plan dolgu islemini (yeniden) baslatir. */
export async function ensureDrainRunning(): Promise<void> {
  currentRemaining = await getPendingQueueCount();
  sessionTotal = Math.max(sessionTotal, currentRemaining);
  notify();

  if (running || currentRemaining === 0) return;

  running = true;
  // `BackgroundTimer.setTimeout` (Android) sadece bir Handler.postDelayed'dir — wake lock
  // tutmaz. Ekran kapanip cihaz Doze'a girince CPU uyur ve bu zamanlayici hic calismaz;
  // dongu ekran acilana/uygulama on plana gelene kadar donmus gorunur. `start()` (ayni
  // kutuphanenin PARTIAL_WAKE_LOCK tutan ayri native metodu) CPU'yu tum oturum boyunca
  // uyanik tutar; `stop()` ile dongu bitince serbest birakilir.
  BackgroundTimer.start();
  loop();
}
