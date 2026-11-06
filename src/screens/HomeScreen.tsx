import React, { useEffect, useState } from 'react';
import { getLeagueIdsWithHt } from '../db/matchesRepo';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, Country, League } from '../types/football';
import CountryAccordion from '../components/CountryAccordion';
import { MOCK_COUNTRIES } from '../utils/mockData';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

/** Ana ekran – ülke listesi ve açılır lig seçimi. */
export default function HomeScreen() {
  const navigation = useNavigation<Nav>();

  const [leagueIdsWithHt, setLeagueIdsWithHt] = useState<Set<number> | null>(null);

  useEffect(() => {
    getLeagueIdsWithHt()
      .then(setLeagueIdsWithHt)
      .catch(() => setLeagueIdsWithHt(null));
  }, []);

  const handleSelectLeague = (league: League) => {
    navigation.navigate('LeagueDetail', {
      leagueId: league.id,
      season: 2026,
      leagueName: league.name,
    });
  };

  const renderCountry = ({ item }: { item: Country }) => (
    <CountryAccordion
      country={item}
      onSelectLeague={handleSelectLeague}
      leagueIdsWithHt={leagueIdsWithHt}
    />
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>⚽ Futbol İstatistikleri</Text>
        <Text style={styles.subtitle}>Başlamak için bir lig seçin</Text>
      </View>

      <FlatList
        data={MOCK_COUNTRIES}
        keyExtractor={(c) => c.code}
        renderItem={renderCountry}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1A73E8',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  list: {
    paddingTop: 10,
    paddingBottom: 40,
  },
});