import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermission,
  startBackgroundSync,
  stopBackgroundSync,
  suspendBackgroundSync,
} from '../services/backgroundSync';

/**
 * Uygulama arka plana atilinca senkronu bir Android foreground service icinde devam ettirir
 * (kalici bildirim ile), on plana donunce servisi kapatir (JS dongusu kesintisiz surer).
 */
export function useBackgroundSyncGuard(): void {
  useEffect(() => {
    requestNotificationPermission();

    const responseSub = Notifications.addNotificationResponseReceivedListener((resp) => {
      if (resp.actionIdentifier === 'stop') stopBackgroundSync();
    });

    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background') startBackgroundSync();
      else if (next === 'active') suspendBackgroundSync();
    });

    return () => {
      responseSub.remove();
      appStateSub.remove();
    };
  }, []);
}
