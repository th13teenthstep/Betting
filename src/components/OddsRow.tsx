import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { FixtureOdds, FixtureOddsValue } from '../types/football';

interface OddsRowProps {
  odds: FixtureOdds;
}

const HUCRELER: { key: keyof FixtureOdds; label: string }[] = [
  { key: 'home', label: '1' },
  { key: 'draw', label: 'X' },
  { key: 'away', label: '2' },
  { key: 'over25', label: 'Ü 2.5' },
  { key: 'under25', label: 'A 2.5' },
];

function formatOran(v: number | null): string {
  return v != null ? v.toFixed(2) : '–';
}

/** Acilis -> kapanis arasindaki yonu belirler: oran dustukce o sonuc guclendi (yesil). */
function yonBelirle(opening: number | null, closing: number | null) {
  if (opening == null || closing == null || opening === closing) {
    return { ok: '—', renk: '#9AA0A6' };
  }
  return closing < opening
    ? { ok: '▼', renk: '#2E7D32' }
    : { ok: '▲', renk: '#C62828' };
}

function OddsHucresi({ label, value }: { label: string; value: FixtureOddsValue }) {
  const { ok, renk } = yonBelirle(value.opening, value.closing);

  return (
    <View style={styles.hucre}>
      <Text style={styles.label}>{label}</Text>
      {/* Acilis ustte, kapanis (ok ile) altta */}
      <Text style={styles.acilisText}>{formatOran(value.opening)}</Text>
      <View style={styles.kapanisSatiri}>
        <Text style={[styles.ok, { color: renk }]}>{ok}</Text>
        <Text style={[styles.kapanisText, { color: renk }]}>{formatOran(value.closing)}</Text>
      </View>
    </View>
  );
}

/** Bet365 1-X-2 ve Ust/Alt 2.5 oranlarini acilis->kapanis seklinde gosterir. */
export default function OddsRow({ odds }: OddsRowProps) {
  return (
    <View style={styles.satir}>
      {HUCRELER.map(({ key, label }) => (
        <OddsHucresi key={key} label={label} value={odds[key]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  satir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hucre: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 8,
    fontWeight: '700',
    color: '#9AA0A6',
    marginBottom: 0,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  kapanisSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  acilisText: {
    fontSize: 10,
    color: '#B5B8BD',
    fontVariant: ['tabular-nums'],
  },
  ok: {
    fontSize: 8,
  },
  kapanisText: {
    fontSize: 10.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
