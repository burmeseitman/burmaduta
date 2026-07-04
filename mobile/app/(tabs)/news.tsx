import React from 'react';
import { View, StyleSheet, FlatList, Text, RefreshControl, SafeAreaView } from 'react-native';
import { useNews } from '../../hooks/useNews';
import { useFilters } from '../../hooks/useFilters';
import FilterBar from '../../components/FilterBar';
import SearchBar from '../../components/SearchBar';
import NewsCard from '../../components/NewsCard';
import LoadingScreen from '../../components/LoadingScreen';

export default function NewsScreen() {
  const { news, loading, refresh } = useNews();
  const {
    filters,
    setRegion,
    setCategory,
    setDate,
    setSearchQuery,
    filteredNews,
  } = useFilters(news);

  if (loading && news.length === 0) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>သတင်းများ</Text>
      </View>
      <SearchBar value={filters.searchQuery} onChangeText={setSearchQuery} />
      <FilterBar
        filters={filters}
        onRegionChange={setRegion}
        onCategoryChange={setCategory}
        onDateChange={setDate}
      />
      <FlatList
        data={filteredNews}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => <NewsCard item={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading && news.length > 0}
            onRefresh={refresh}
            tintColor="#f7b731"
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>ရှာဖွေမှုရလဒ် မရှိပါ</Text>
        }
      />
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
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  listContent: {
    paddingBottom: 20,
    paddingTop: 8,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
});
