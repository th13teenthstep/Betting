import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types/football';
import HtFtResultsView from './HtFtResultsView';

type Route = RouteProp<RootStackParamList, 'TakimMaclari'>;

/**
 * Belirli bir takimin maclarini filtreleyen ekran.
 * URL'den gelen takimId ile HtFtResultsView'e takim filtresi ekler.
 */
export default function TakimMaclariScreen() {
  const route = useRoute<Route>();
  const { leagueId, season, takimId } = route.params;

  return (
    <View style={styles.screen}>
      <HtFtResultsView leagueId={leagueId} season={season} takimId={takimId} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
});