import { useState, useMemo, useCallback } from 'react';
import { NewsItem, FilterState } from '../services/types';

function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function matchesLocation(item: NewsItem, selectedRegion: string): boolean {
  if (!selectedRegion || selectedRegion === 'All' || selectedRegion === 'အားလုံး') return true;
  const targets = [item.region, item.city, item.township].map(s => (s || '').toLowerCase());
  const filter = selectedRegion.toLowerCase();
  return targets.some(t => t.includes(filter));
}

export function useFilters(allNews: NewsItem[]) {
  const [filters, setFilters] = useState<FilterState>({
    region: 'All',
    category: 'All',
    date: getLocalDateString(),
    searchQuery: '',
  });

  const setRegion = useCallback((region: string) => setFilters(prev => ({ ...prev, region })), []);
  const setCategory = useCallback((category: string) => setFilters(prev => ({ ...prev, category })), []);
  const setDate = useCallback((date: string) => setFilters(prev => ({ ...prev, date })), []);
  const setSearchQuery = useCallback((searchQuery: string) => setFilters(prev => ({ ...prev, searchQuery })), []);
  const resetFilters = useCallback(() => setFilters({
    region: 'All',
    category: 'All',
    date: getLocalDateString(),
    searchQuery: '',
  }), []);

  const filteredNews = useMemo(() => {
    return allNews.filter(item => {
      const hasLocation = item.township || item.city || item.region;
      if (!hasLocation) return false;

      const itemDateStr = item.publish_date || '';
      const itemDate = itemDateStr.toString().split('T')[0].split(' ')[0];
      const matchesDate = !filters.date || itemDate === filters.date;
      const matchesReg = matchesLocation(item, filters.region);
      const matchesType = filters.category === 'All' || item.crime_type === filters.category;

      const textToSearch = (
        (item.raw_text || '') +
        (item.summary || '') +
        (item.township || '') +
        (item.city || '')
      ).toLowerCase();
      const matchesSearch = !filters.searchQuery || textToSearch.includes(filters.searchQuery.toLowerCase());

      return matchesDate && matchesReg && matchesType && matchesSearch;
    });
  }, [allNews, filters]);

  const mappableNews = useMemo(() => {
    return filteredNews.filter(
      item => item.lat != null && item.lng != null && item.lat !== 0 && item.lng !== 0
    );
  }, [filteredNews]);

  return {
    filters,
    setRegion,
    setCategory,
    setDate,
    setSearchQuery,
    resetFilters,
    filteredNews,
    mappableNews,
  };
}
