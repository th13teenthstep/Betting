import React from 'react';
import { TouchableOpacity } from 'react-native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '../types/football';
import MainTabs from './MainTabs';
import LeagueDetailScreen from '../screens/LeagueDetailScreen';
import TakimMaclariScreen from '../screens/TakimMaclariScreen';


const Stack = createNativeStackNavigator<RootStackParamList>();

/** Ust cubukta gozuken ana sayfa butonu. */
function AnaSayfaButonu() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <TouchableOpacity
      onPress={() => navigation.popToTop()}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="home" size={22} color="#FFF" />
    </TouchableOpacity>
  );
}

/** Kok navigator. */
export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Home"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LeagueDetail"
        component={LeagueDetailScreen}
        options={({ route }) => ({
          title: route.params.leagueName,
          headerStyle: { backgroundColor: '#1A73E8' },
          headerTintColor: '#FFF',
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          headerBackTitle: 'Geri',
          headerRight: () => <AnaSayfaButonu />,
        })}
      />
      <Stack.Screen
        name="TakimMaclari"
        component={TakimMaclariScreen}
        options={({ route }) => ({
          title: route.params.takimAdi,
          headerStyle: { backgroundColor: '#1A73E8' },
          headerTintColor: '#FFF',
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          headerBackTitle: 'Geri',
          headerRight: () => <AnaSayfaButonu />,
        })}
      />
    </Stack.Navigator>
  );
}