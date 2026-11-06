import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

const label = (s: number) => `${s}/${String(s + 1).slice(-2)}`;

interface Props {
  /** Secilebilecek sezonlar (yeni -> eski). */
  seasons: number[];
  selected: number[];
  onChange: (selected: number[]) => void;
}

/** Istedigi kadar sezon secme: hizli secimler (Son 1/2/3, Tumu) + tek tek isaretleme. */
export default function SeasonMultiSelect({ seasons, selected, onChange }: Props) {
  const isLast = (n: number) =>
    selected.length === Math.min(n, seasons.length) &&
    seasons.slice(0, n).every((s) => selected.includes(s));
  const isAll = selected.length === seasons.length;

  const toggle = (s: number) => {
    if (selected.includes(s)) {
      if (selected.length > 1) onChange(selected.filter((x) => x !== s)); // en az 1 sezon kalsin
    } else {
      onChange([...selected, s].sort((a, b) => b - a));
    }
  };

  const quick: { text: string; active: boolean; apply: () => void }[] = [
    ...[1, 2, 3]
      .filter((n) => n <= seasons.length)
      .map((n) => ({
        text: `Son ${n}`,
        active: isLast(n),
        apply: () => onChange(seasons.slice(0, n)),
      })),
    { text: 'Tümü', active: isAll, apply: () => onChange([...seasons]) },
  ];

  return (
    <View>
      <View style={styles.quickRow}>
        {quick.map((q) => (
          <TouchableOpacity
            key={q.text}
            onPress={q.apply}
            style={[styles.quick, q.active && styles.quickActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.quickText, q.active && styles.quickTextActive]}>{q.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {seasons.map((s) => {
          const on = selected.includes(s);
          return (
            <TouchableOpacity
              key={s}
              onPress={() => toggle(s)}
              style={[styles.chip, on && styles.chipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, on && styles.chipTextActive]}>
                {on ? '✓ ' : ''}
                {label(s)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  quickRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  quick: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#E8EEF9' },
  quickActive: { backgroundColor: '#1A73E8' },
  quickText: { fontSize: 12, fontWeight: '700', color: '#1A73E8' },
  quickTextActive: { color: '#FFF' },
  row: { gap: 6, paddingRight: 8 },
  chip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#1A73E8' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#555' },
  chipTextActive: { color: '#FFF' },
});
