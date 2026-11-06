import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SQLite from 'expo-sqlite';
import RootNavigator from './src/navigation/RootNavigator';
import { DB_NAME, LEGACY_DB_NAMES } from './src/db/database';
import { useBackgroundSyncGuard } from './src/hooks/useBackgroundSyncGuard';

/**
 * ~/Desktop/MatchResults'tan onceden toplu olarak import edilmis SQLite
 * dosyasini (assets/betting.db) cihaza kopyalar. Dosya zaten varsa
 * (ikinci acilistan itibaren) hicbir sey yapmaz — aninda devam eder.
 */
async function hazirlaVeritabani(): Promise<void> {
  // Surume ozel dosya adi (bkz. db/database.ts): yoksa asset'ten kopyalanir, varsa
  // dokunulmaz. Eski surumlerin dosyalari yer kaplamasin diye best-effort silinir.
  await SQLite.importDatabaseFromAssetAsync(DB_NAME, {
    assetId: require('./assets/betting.db'),
  });
  for (const eski of LEGACY_DB_NAMES) {
    try {
      await SQLite.deleteDatabaseAsync(eski);
    } catch {
      /* yoksa sorun degil */
    }
  }
}

export default function App() {
  const [hazir, setHazir] = useState(false);

  useBackgroundSyncGuard();

  useEffect(() => {
    let iptalEdildi = false;
    hazirlaVeritabani()
      .catch((err) => console.warn('[DB] Seed import hatasi:', err))
      .finally(() => {
        if (!iptalEdildi) setHazir(true);
      });
    return () => {
      iptalEdildi = true;
    };
  }, []);

  if (!hazir) {
    return (
      <View style={styles.yukleniyor}>
        <ActivityIndicator size="large" color="#1A73E8" />
        <Text style={styles.yukleniyorText}>Veritabani hazirlaniyor…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <RootNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  yukleniyor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6FA',
    gap: 12,
  },
  yukleniyorText: {
    fontSize: 14,
    color: '#666',
  },
});
