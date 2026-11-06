import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { expectedApiMs } from '../services/apiTiming';

interface Props {
  visible: boolean;
  title: string;
  /** Beklenen sure (ms). Verilmezse son API isteklerinin ortalamasindan hesaplanir. */
  expectedMs?: number;
  /**
   * Gercek ilerleme biliniyorsa (orn. 12 orandan 3'u geldi): yuzde done/total'dan,
   * kalan sure kalan adet x adim suresinden hesaplanir (tahmin degil, sayim).
   */
  progress?: { done: number; total: number; perItemMs: number };
}

/**
 * API cevabi beklenirken gorunur bir ilerleme cubugu: yuzde + tahmini kalan sure.
 * Sunucu gercek ilerleme bildirmedigi icin yuzde TAHMINIDIR: beklenen sureye gore
 * %95'e dogru yavas yavas dolar, veri gelince cubuk kapanir. Sure asilirsa
 * kullanici "bozuldu" sanmasin diye bunu acikca yazar.
 */
export default function ApiLoadingBar({ visible, title, expectedMs, progress }: Props) {
  const expected = expectedMs ?? expectedApiMs();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const start = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Date.now() - start), 150);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  let percent: number;
  let overdue: boolean;
  let remainingSec: number;
  if (progress && progress.total > 0) {
    const remaining = Math.max(0, progress.total - progress.done);
    percent = Math.min(99, Math.round((100 * progress.done) / progress.total));
    remainingSec = Math.max(1, Math.ceil((remaining * progress.perItemMs) / 1000));
    overdue = false;
  } else {
    percent = Math.min(95, Math.round(95 * (1 - Math.exp((-3 * elapsed) / expected))));
    overdue = elapsed > expected * 1.15;
    remainingSec = Math.max(1, Math.ceil((expected - elapsed) / 1000));
  }

  return (
    <View style={styles.box}>
      <View style={styles.topRow}>
        <Text style={styles.title}>
          {title}
          {progress && progress.total > 0 ? ` (${Math.min(progress.done + 1, progress.total)}/${progress.total})` : ''}
        </Text>
        <Text style={styles.percent}>%{percent}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.eta}>
        {overdue
          ? 'Sunucu beklenenden yavaş yanıt veriyor, lütfen bekleyin…'
          : `Tahmini kalan süre: ~${remainingSec} sn`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#FFF',
    marginHorizontal: 8,
    marginVertical: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6E4FB',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 13, fontWeight: '700', color: '#1A73E8' },
  percent: { fontSize: 13, fontWeight: '800', color: '#1A73E8', fontVariant: ['tabular-nums'] },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8EEF9',
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#1A73E8' },
  eta: { fontSize: 11, color: '#777', marginTop: 6 },
});
