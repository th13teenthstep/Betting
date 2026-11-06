import BackgroundService from 'react-native-background-actions';
import BackgroundTimer from 'react-native-background-timer';
import * as Notifications from 'expo-notifications';
import { ensureDrainRunning, getSyncProgressState, requestStop } from '../db/syncEngine';
import { formatEta } from '../components/SyncProgressBar';

const STOP_CATEGORY = 'sync-controls';
let stopCategoryReady = false;

async function ensureStopCategory(): Promise<void> {
  if (stopCategoryReady) return;
  await Notifications.setNotificationCategoryAsync(STOP_CATEGORY, [
    { identifier: 'stop', buttonTitle: 'Durdur', options: { opensAppToForeground: false } },
  ]);
  stopCategoryReady = true;
}

async function postStopNotification(): Promise<void> {
  await ensureStopCategory();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Senkronizasyon arka planda çalışıyor',
      body: 'Durdurmak için dokunun.',
      categoryIdentifier: STOP_CATEGORY,
    },
    trigger: null,
  });
}

const backgroundTask = async (): Promise<void> => {
  await ensureDrainRunning();
  while (BackgroundService.isRunning() && getSyncProgressState().active) {
    const state = getSyncProgressState();
    await BackgroundService.updateNotification({
      taskDesc: `İY ve oran verileri yükleniyor · %${state.percent} · ${formatEta(state.etaMinutes)}`,
      progressBar: { max: 100, value: state.percent, indeterminate: false },
    });
    await new Promise((resolve) => BackgroundTimer.setTimeout(resolve, 3000));
  }
};

async function teardownService(): Promise<void> {
  if (BackgroundService.isRunning()) {
    await BackgroundService.stop();
  }
  await Notifications.dismissAllNotificationsAsync();
}

/** Bildirim izni ister; reddedilirse servis yine de calisir, sadece gorunur ilerleme olmaz. */
export async function requestNotificationPermission(): Promise<void> {
  try {
    await Notifications.requestPermissionsAsync();
  } catch {
    // izin istegi basarisiz olursa sessizce devam
  }
}

/** Senkron aktifse arka plan foreground service'ini (kalici bildirimle) baslatir. */
export async function startBackgroundSync(): Promise<void> {
  if (BackgroundService.isRunning() || !getSyncProgressState().active) return;
  await BackgroundService.start(backgroundTask, {
    taskName: 'BettingSync',
    taskTitle: 'Betting – Veri senkronizasyonu',
    taskDesc: 'İY ve oran verileri yükleniyor…',
    taskIcon: { name: 'ic_launcher', type: 'mipmap' },
    color: '#1A73E8',
    progressBar: { max: 100, value: 0, indeterminate: false },
    foregroundServiceType: ['dataSync'],
  });
  await postStopNotification();
}

/** Uygulama on plana donunce: sadece servisi/bildirimi kapatir, senkron JS dongusu normal sekilde devam eder. */
export async function suspendBackgroundSync(): Promise<void> {
  await teardownService();
}

/** "Durdur" bildirim aksiyonundan: senkronu tamamen durdurur. */
export async function stopBackgroundSync(): Promise<void> {
  requestStop();
  await teardownService();
}
