import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AnalizStackParamList } from '../types/football';
import AnalizHomeScreen from '../screens/AnalizHomeScreen';
import AnalizTeamsScreen from '../screens/AnalizTeamsScreen';
import AnalizDetailScreen from '../screens/AnalizDetailScreen';

const Stack = createNativeStackNavigator<AnalizStackParamList>();

const HEADER = {
  headerStyle: { backgroundColor: '#1A73E8' },
  headerTintColor: '#FFF',
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 18 },
  headerBackTitle: 'Geri',
};

/** Analiz sekmesi: lig sec → takim sec → oran/istatistik analizi. */
export default function AnalizNavigator() {
  return (
    <Stack.Navigator screenOptions={{ animation: 'slide_from_right' }}>
      <Stack.Screen name="AnalizHome" component={AnalizHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="AnalizTeams"
        component={AnalizTeamsScreen}
        options={({ route }) => ({ title: route.params.leagueName, ...HEADER })}
      />
      <Stack.Screen
        name="AnalizDetail"
        component={AnalizDetailScreen}
        options={({ route }) => ({ title: route.params.teamName, ...HEADER })}
      />
    </Stack.Navigator>
  );
}
