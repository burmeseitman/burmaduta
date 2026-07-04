import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const icon = name === 'map' ? '🗺️' : name === 'news' ? '📰' : name === 'stats' ? '📊' : '⚙️';
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
      <Text style={[styles.icon, { opacity: focused ? 1 : 0.5 }]}>{icon}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBar.background,
          borderTopColor: Colors.tabBar.border,
          borderTopWidth: 1,
          elevation: 0,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.tabBar.active,
        tabBarInactiveTintColor: Colors.tabBar.inactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'မြေပုံ',
          tabBarIcon: ({ focused }) => <TabBarIcon name="map" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'သတင်းများ',
          tabBarIcon: ({ focused }) => <TabBarIcon name="news" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'စာရင်းဇယား',
          tabBarIcon: ({ focused }) => <TabBarIcon name="stats" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'ဆက်တင်',
          tabBarIcon: ({ focused }) => <TabBarIcon name="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  iconContainerFocused: {
    backgroundColor: 'rgba(247, 183, 49, 0.1)',
  },
  icon: {
    fontSize: 18,
  },
});
