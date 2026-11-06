import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Fixture, RootStackParamList } from '../types/football';
import HtFtBadge from './HtFtBadge';
import OddsRow from './OddsRow';
import ReversalBadge from './ReversalBadge';

/** Fikstur (oynanmamis mac) gorunumu icin istege bagli eklemeler. */
export interface MatchCardExtras {
  /** true: IY/MS skorlari yerine baslama saati gosterilir. */
  scheduled?: boolean;
  kickoffTime?: string;
  /** Sag alttaki tarih metnini degistirir (orn. "Cmt 7 Kas"). */
  dayLabel?: string;
  /** Takim adinin yanindaki yesil daire: sayi / null (veri yok) / undefined (daire yok). */
  homeBadge?: number | null;
  awayBadge?: number | null;
  /** Takima dokununca takim maclarina gitmeyi kapatir (DB karsiligi bilinmiyorsa). */
  disableTeamPress?: boolean;
}

interface MatchCardProps {
  fixture: Fixture;
  leagueId: number;
  season: number;
  extras?: MatchCardExtras;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Tarihi "25 May 2024" gibi kisa formatta gosterir. */
function formatTarih(iso: string): string {
  const aylar = [
    'Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz',
    'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara',
  ];
  const d = new Date(iso);
  const gun = d.getDate();
  const ay = aylar[d.getMonth()];
  const yil = d.getFullYear();
  return `${gun} ${ay} ${yil}`;
}

/** Tek bir mac satirini gosterir. Takimlara tiklayinca o takimin maclarina gider. */
export default function MatchCard({ fixture, leagueId, season, extras }: MatchCardProps) {
  const navigation = useNavigation<Nav>();
  const { teams, score, fixture: info } = fixture;

  const ht = score?.halftime ?? { home: null, away: null };
  const ft = score?.fulltime ?? { home: null, away: null };

  const takimaGit = (takimId: number, takimAdi: string) => {
    if (extras?.disableTeamPress) return;
    navigation.navigate('TakimMaclari', {
      leagueId,
      season,
      takimId,
      takimAdi,
    });
  };

  return (
    <View style={styles.card}>
      {/* Satir 1: ev sahibi | IY | MS | deplasman */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.teamCol, styles.teamHome]}
          onPress={() => takimaGit(teams.home.id, teams.home.name)}
          activeOpacity={0.5}
        >
          <Text style={styles.teamName} numberOfLines={1}>
            {teams.home.name}
          </Text>
          {teams.home.logo ? <Image source={{ uri: teams.home.logo }} style={styles.logo} /> : null}
        </TouchableOpacity>
        {extras?.homeBadge !== undefined && <ReversalBadge value={extras.homeBadge} />}

        {extras?.scheduled ? (
          <View style={styles.scoreCol}>
            <Text style={styles.kickoff}>{extras.kickoffTime ?? '--:--'}</Text>
          </View>
        ) : (
          <View style={styles.scoreCol}>
            <Text style={styles.ht}>
              {ht.home == null && ht.away == null ? '–' : `${ht.home ?? '-'}-${ht.away ?? '-'}`}
            </Text>
            <Text style={styles.ft}>
              {ft.home ?? '-'} - {ft.away ?? '-'}
            </Text>
          </View>
        )}

        {extras?.awayBadge !== undefined && <ReversalBadge value={extras.awayBadge} />}

        <TouchableOpacity
          style={[styles.teamCol, styles.teamAway]}
          onPress={() => takimaGit(teams.away.id, teams.away.name)}
          activeOpacity={0.5}
        >
          {teams.away.logo ? <Image source={{ uri: teams.away.logo }} style={styles.logo} /> : null}
          <Text style={styles.teamName} numberOfLines={1}>
            {teams.away.name}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Satir 2: rozet | Bet365 oranlari | tarih */}
      <View style={styles.altRow}>
        <View style={styles.badgeSlot}>
          <HtFtBadge outcome={fixture.htFtResult ?? null} />
        </View>
        <View style={styles.oddsSlot}>{fixture.odds && <OddsRow odds={fixture.odds} />}</View>
        <Text style={styles.tarih}>
          {extras?.dayLabel ?? (info?.date ? formatTarih(info.date) : '')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 6,
    marginVertical: 1.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  teamHome: { justifyContent: 'flex-end' },
  teamAway: { justifyContent: 'flex-start' },
  logo: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  teamName: {
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1A73E8',
  },
  scoreCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    minWidth: 92,
  },
  kickoff: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
    fontVariant: ['tabular-nums'],
  },
  ht: {
    fontSize: 11,
    color: '#8A8F98',
    fontVariant: ['tabular-nums'],
  },
  ft: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    fontVariant: ['tabular-nums'],
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 18,
  },
  badgeSlot: { width: 34 },
  oddsSlot: { flex: 1 },
  tarih: {
    width: 62,
    textAlign: 'right',
    fontSize: 10,
    color: '#999',
    fontWeight: '500',
  },
});
