import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import type { Standing } from '../types/football';

interface StandingsTableProps {
  standings: Standing[];
}

const COLS = [
  { key: 'pos', label: '#', width: 28 },
  { key: 'team', label: 'Team', width: null }, // flex
  { key: 'p', label: 'P', width: 28 },
  { key: 'w', label: 'W', width: 28 },
  { key: 'd', label: 'D', width: 28 },
  { key: 'l', label: 'L', width: 28 },
  { key: 'gf', label: 'GF', width: 30 },
  { key: 'ga', label: 'GA', width: 30 },
  { key: 'pts', label: 'PTS', width: 36 },
] as const;

/** A full league standings table with a sticky header row. */
export default function StandingsTable({ standings }: StandingsTableProps) {
  return (
    <ScrollView horizontal style={styles.hScroll}>
      <View>
        {/* Header */}
        <View style={styles.headerRow}>
          {COLS.map((col) => (
            <View
              key={col.key}
              style={[
                styles.cell,
                col.key === 'team' ? styles.cellTeam : { width: col.width },
                styles.headerCell,
              ]}
            >
              <Text style={styles.headerText}>{col.label}</Text>
            </View>
          ))}
        </View>

        {/* Rows */}
        {standings.map((row) => (
          <View key={row.team.id} style={styles.dataRow}>
            {/* Position */}
            <View style={[styles.cell, { width: COLS[0].width }]}>
              <Text style={styles.posText}>{row.rank}</Text>
            </View>
            {/* Team */}
            <View style={[styles.cell, styles.cellTeam]}>
              {row.team?.logo ? (
                <Image source={{ uri: row.team.logo }} style={styles.teamLogo} />
              ) : (
                <View style={styles.teamLogo} />
              )}
              <Text style={styles.teamText} numberOfLines={1}>
                {row.team?.name ?? ''}
              </Text>
            </View>
            {/* P */}
            <View style={[styles.cell, { width: COLS[2].width }]}>
              <Text style={styles.cellText}>{row.all?.played ?? 0}</Text>
            </View>
            {/* W */}
            <View style={[styles.cell, { width: COLS[3].width }]}>
              <Text style={styles.cellText}>{row.all?.win ?? 0}</Text>
            </View>
            {/* D */}
            <View style={[styles.cell, { width: COLS[4].width }]}>
              <Text style={styles.cellText}>{row.all?.draw ?? 0}</Text>
            </View>
            {/* L */}
            <View style={[styles.cell, { width: COLS[5].width }]}>
              <Text style={styles.cellText}>{row.all?.lose ?? 0}</Text>
            </View>
            {/* GF */}
            <View style={[styles.cell, { width: COLS[6].width }]}>
              <Text style={styles.cellText}>{row.all?.goals?.for ?? 0}</Text>
            </View>
            {/* GA */}
            <View style={[styles.cell, { width: COLS[7].width }]}>
              <Text style={styles.cellText}>{row.all?.goals?.against ?? 0}</Text>
            </View>
            {/* PTS */}
            <View style={[styles.cell, { width: COLS[8].width }]}>
              <Text style={[styles.cellText, styles.ptsText]}>{row.points}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hScroll: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#F7F8FA',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  headerCell: {
    paddingVertical: 10,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  cellTeam: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  teamLogo: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  posText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
  },
  teamText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
    flexShrink: 1,
  },
  cellText: {
    fontSize: 13,
    color: '#444',
    fontVariant: ['tabular-nums'],
  },
  ptsText: {
    fontWeight: '800',
    color: '#111',
  },
});