import React from 'react';
import { View, StyleSheet, ScrollView, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNews } from '../../hooks/useNews';
import DangerousTownships from '../../components/DangerousTownships';
import CategoryChart from '../../components/CategoryChart';
import TrendChart from '../../components/TrendChart';
import LoadingScreen from '../../components/LoadingScreen';

export default function StatsScreen() {
  const { news, loading, refresh } = useNews();

  if (loading && news.length === 0) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>စာရင်းဇယားများ</Text>
        <Text style={styles.subtitle}>Burma Duta Data Insights</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#f7b731" />}
      >
        <DangerousTownships news={news} />
        <CategoryChart news={news} />
        <TrendChart news={news} />
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            စုစုပေါင်း မှတ်တမ်း: <Text style={styles.highlight}>{news.length}</Text> ခု
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0b',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 13,
    color: '#f7b731',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
  },
  highlight: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
