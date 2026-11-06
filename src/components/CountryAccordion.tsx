import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import type { Country, League } from '../types/football';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CountryAccordionProps {
  country: Country;
  onSelectLeague: (league: League) => void;
  /** IY skoru olan lig id'leri. null ise henuz yuklenmedi (isaret gosterilmez). */
  leagueIdsWithHt: Set<number> | null;
}

/** Single country row that expands to show its leagues. */
export default function CountryAccordion({
  country,
  onSelectLeague,
  leagueIdsWithHt,
}: CountryAccordionProps) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      {/* Country Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={0.6}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={styles.countryName}>{country.name}</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* League List */}
      {expanded && (
        <View style={styles.leagueList}>
          {country.leagues.map((league) => (
            <TouchableOpacity
              key={league.id}
              style={styles.leagueRow}
              onPress={() => onSelectLeague(league)}
              activeOpacity={0.5}
            >
              <Image source={{ uri: league.logo }} style={styles.leagueLogo} />
              <Text style={styles.leagueName}>
                {league.name}
                {leagueIdsWithHt && !leagueIdsWithHt.has(league.id) ? ' - *' : ''}
              </Text>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flag: {
    fontSize: 22,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  chevron: {
    fontSize: 12,
    color: '#999',
  },
  leagueList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE',
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  leagueLogo: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  leagueName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  arrow: {
    fontSize: 20,
    color: '#BBB',
    fontWeight: '300',
  },
});