import { useEffect, useState } from 'react';
import {
  getSyncProgressState,
  subscribeSyncProgress,
  type SyncProgressState,
} from '../db/syncEngine';

/** IY skoru + Bet365 oran arka plan senkronunun canli ilerleme durumu. */
export function useSyncProgress(): SyncProgressState {
  const [state, setState] = useState<SyncProgressState>(getSyncProgressState);

  useEffect(() => subscribeSyncProgress(setState), []);

  return state;
}
