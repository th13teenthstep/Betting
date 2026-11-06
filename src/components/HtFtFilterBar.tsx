import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { HtFtFilter } from '../types/football';
import { HTFT_FILTERS } from '../types/football';

interface HtFtFilterBarProps {
  selected: HtFtFilter;
  onSelect: (filter: HtFtFilter) => void;
  /** Filtre basina mac sayisi, orn. { "1/1": 5, "2/1": 13, ALL: 38 }. */
  counts?: Partial<Record<HtFtFilter, number>>;
}

/** IY/MS sonuc filtresi icin yatay kaydirilabilir buton cubugu. */
export default function HtFtFilterBar({
  selected,
  onSelect,
  counts = {},
}: HtFtFilterBarProps) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {HTFT_FILTERS.map((filter) => {
          const active = filter === selected;
          const count = counts[filter as HtFtFilter];
          const label =
            count !== undefined ? `${filter} (${count})` : filter;

          return (
            <TouchableOpacity
              key={filter}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelect(filter)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    maxHeight: 42,
    backgroundColor: '#F5F6FA',
  },
  container: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    height: 30,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#1A73E8',
    borderColor: '#1557B0',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  chipTextActive: {
    color: '#FFF',
  },
});