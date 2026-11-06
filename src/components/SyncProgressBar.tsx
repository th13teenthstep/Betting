import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SyncProgressState } from '../db/syncEngine';

interface Props {
  state: SyncProgressState;
}

export function formatEta(etaMinutes: number): string {
  if (etaMinutes <= 0) return 'birazdan bitiyor';
  if (etaMinutes === 1) return '~1 dakika kaldi';
  return `~${etaMinutes} dakika kaldi`;
}

/** IY skoru + Bet365 oran arka plan dolgusunun yuzde/sure gostergesi. */
export default function SyncProgressBar({ state }: Props) {
  if (!state.active) return null;

  return (
    <View style={styles.container}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${state.percent}%` }]} />
      </View>
      <Text style={styles.label}>
        IY ve oran verileri yukleniyor · %{state.percent} · {formatEta(state.etaMinutes)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0F3C78',
  },
  barTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#4FC3F7',
  },
  label: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
});
