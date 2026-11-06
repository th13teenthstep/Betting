import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

/** 0.00 = birebir ayni oran (tam eslesme), ardindan 0.05 ... 0.50 (sabit oran farki). */
export const TOLERANCE_OPTIONS: number[] = [
  0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
];

function optionLabel(opt: number): string {
  return `±${opt.toFixed(2)}`;
}

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Altta gosterilecek aciklama (orn. "bu ligde acilis orani yok"). */
  note?: string;
}

/** Yatay kaydirilabilir sabit tolerans secici (±0.10 gibi oran farki). */
export default function ToleranceChips({
  label,
  value,
  onChange,
  disabled,
  note,
}: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TOLERANCE_OPTIONS.map((opt) => {
          const active = opt === value;
          return (
            <TouchableOpacity
              key={String(opt)}
              disabled={disabled}
              onPress={() => onChange(opt)}
              activeOpacity={0.7}
              style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {optionLabel(opt)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#555' },
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
  chipDisabled: { opacity: 0.45 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#555' },
  chipTextActive: { color: '#FFF' },
  note: { fontSize: 11, color: '#C62828', marginTop: 4 },
});
