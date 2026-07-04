import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NewsItem } from '../services/types';

const categoryColors: Record<string, string> = {
  'စစ်ရေးသတင်း': '#e74c3c',
  'မှုခင်းသတင်း': '#9b59b6',
  'မတော်တဆဖြစ်မှု': '#f1c40f',
  'သဘာဝဘေးအန္တရာယ်': '#e67e22',
  'အထွေထွေ': '#3498db',
};

const categoryIcons: Record<string, string> = {
  'စစ်ရေးသတင်း': '⚔️',
  'မှုခင်းသတင်း': '🚨',
  'မတော်တဆဖြစ်မှု': '⚠️',
  'သဘာဝဘေးအန္တရာယ်': '🌊',
  'အထွေထွေ': 'ℹ️',
};

interface Props {
  news: NewsItem[];
}

export default function CategoryChart({ news }: Props) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    news.forEach(item => {
      counts[item.crime_type] = (counts[item.crime_type] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [news]);

  const maxCount = data.length > 0 ? data[0].count : 1;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ဖြစ်စဉ်အလိုက် စာရင်းဇယားများ</Text>
      {data.map(({ name, count }) => {
        const color = categoryColors[name] || '#7f8c8d';
        const icon = categoryIcons[name] || '📍';
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
        return (
          <View key={name} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.icon}>{icon}</Text>
              <Text style={styles.label}>{name}</Text>
              <Text style={styles.count}>{count} ({pct}%)</Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${(count / maxCount) * 100}%`,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
      {data.length === 0 && (
        <Text style={styles.empty}>ဒေတာ မရှိပါ</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1f',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  row: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  icon: {
    fontSize: 14,
    marginRight: 8,
  },
  label: {
    fontSize: 13,
    color: '#ffffff',
    flex: 1,
  },
  count: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  barBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  empty: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    padding: 20,
  },
});
