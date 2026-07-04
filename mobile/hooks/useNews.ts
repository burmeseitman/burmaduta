import { useState, useEffect, useCallback } from 'react';
import { NewsItem } from '../services/types';
import { fetchNews } from '../services/api';

export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadNews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchNews();
      setNews(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
    const interval = setInterval(loadNews, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadNews]);

  return { news, loading, error, lastUpdated, refresh: loadNews };
}
