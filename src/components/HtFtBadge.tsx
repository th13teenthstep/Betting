import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { HtFtResult } from '../types/football';

interface HtFtBadgeProps {
  outcome: HtFtResult | null;
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  '1/1': { bg: '#E3F2FD', text: '#1565C0' },
  '1/X': { bg: '#E8F5E9', text: '#2E7D32' },
  '1/2': { bg: '#FFF3E0', text: '#E65100' },
  'X/1': { bg: '#F3E5F5', text: '#7B1FA2' },
  'X/X': { bg: '#ECEFF1', text: '#546E7A' },
  'X/2': { bg: '#FCE4EC', text: '#C62828' },
  '2/1': { bg: '#FFF8E1', text: '#F9A825' },
  '2/X': { bg: '#E0F2F1', text: '#00695C' },
  '2/2': { bg: '#FFEBEE', text: '#B71C1C' },
};

/** IY/MS sonucunu gosteren kucuk renkli rozet. */
export default function HtFtBadge({ outcome }: HtFtBadgeProps) {
  if (!outcome) return null;

  const colors = BADGE_COLORS[outcome] ?? { bg: '#EEE', text: '#333' };

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{outcome}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});