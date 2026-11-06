import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AnalizStackParamList, Country, League } from '../types/football';
import CountryAccordion from '../components/CountryAccordion';
import { MOCK_COUNTRIES } from '../utils/mockData';
import { hasApiCompetition } from '../services/analysisApi';

type Nav = NativeStackNavigationProp<AnalizStackParamList, 'AnalizHome'>;

/** Analiz – 1. adim: ulke > lig secimi (yalnizca API'den fiksturu cekilebilen ligler). */
export default function AnalizHomeScreen() {
  const navigation = useNavigation<Nav>();

  const countries = useMemo(
    () =>
      MOCK_COUNTRIES.map((c) => ({
        ...c,
        leagues: c.leagues.filter((l) => hasApiCompetition(l.id)),
      })).filter((c) => c.leagues.length > 0),
    [],
  );

  const onSelectLeague = (league: League) =>
    navigation.navigate('AnalizTeams', { leagueId: league.id, leagueName: league.name });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>📈 Analiz</Text>
        <Text style={styles.subtitle}>Analiz için bir lig seçin</Text>
      </View>
      <FlatList
        data={countries}
        keyExtractor={(c: Country) => c.code}
        renderItem={({ item }) => (
          <CountryAccordion country={item} onSelectLeague={onSelectLeague} leagueIdsWithHt={null} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6FA' },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1A73E8',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  list: { paddingTop: 10, paddingBottom: 40 },
});
