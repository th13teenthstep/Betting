import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Takimin bu sezon kac macinin 1/2 ya da 2/1 bittigini gosteren yesil daire.
 * 0 ise soluk yesil, veri yoksa (null) gri "–".
 */
export default function ReversalBadge({ value }: { value: number | null }) {
  return (
    <View style={[styles.badge, value === 0 && styles.zero, value == null && styles.none]}>
      <Text style={styles.text}>{value == null ? '–' : value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2E9E4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zero: { backgroundColor: '#A9D6B7' },
  none: { backgroundColor: '#D5D8DE' },
  text: { fontSize: 11, fontWeight: '800', color: '#FFF' },
});
