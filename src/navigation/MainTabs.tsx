import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from '../types/football';
import HomeScreen from '../screens/HomeScreen';
import WeekStatsScreen from '../screens/WeekStatsScreen';
import AnalizNavigator from './AnalizNavigator';
import AramaScreen from '../screens/AramaScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const HEADER = {
  headerStyle: { backgroundColor: '#1A73E8' },
  headerTintColor: '#FFF',
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 18 },
};

/** Alt navigasyon cubugu: Ulkeler (acilis sayfasi) · Hafta Istatistikleri · Analiz. */
export default function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Ulkeler"
      screenOptions={{
        tabBarActiveTintColor: '#1A73E8',
        tabBarInactiveTintColor: '#8A8F98',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Ulkeler"
        component={HomeScreen}
        options={{
          title: 'Ülkeler',
          headerShown: false, // HomeScreen kendi mavi basligini cizer
          tabBarIcon: ({ color, size }) => <Ionicons name="earth" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="HaftaIstatistikleri"
        component={WeekStatsScreen}
        options={{
          title: 'Hafta İstatistikleri',
          ...HEADER,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Analiz"
        component={AnalizNavigator}
        options={{
          title: 'Analiz',
          headerShown: false, // kendi yigininin basliklarini kullanir
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Arayis"
        component={AramaScreen}
        options={{
          title: 'Arayış',
          ...HEADER,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
