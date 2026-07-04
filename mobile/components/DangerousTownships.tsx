import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NewsItem } from '../services/types';

const DANGER_WEIGHTS: Record<string, number> = {
  'စစ်ရေးသတင်း': 5,
  'မှုခင်းသတင်း': 3,
  'မတော်တဆဖြစ်မှု': 2,
  'သဘာဝဘေးအန္တရာယ်': 4,
  'အထွေထွေ': 1,
};

interface Props {
  news: NewsItem[];
}

export default function DangerousTownships({ news }: Props) {
  const townships = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const scores: Record<string, number> = {};
    news.forEach(item => {
      if (!item.township) return;
      const itemMonth = (item.publish_date || '').substring(0, 7);
      if (itemMonth !== thisMonth) return;
      const weight = DANGER_WEIGHTS[item.crime_type] || 1;
      scores[item.township] = (scores[item.township] || 0) + weight;
    });

    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [news]);

  const maxScore = townships.length > 0 ? townships[0][1] : 1;

  if (townships.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚩 အန္တရာယ်ရှိသော မြို့နယ်များ</Text>
        <Text style={styles.subtitle}>(ယခုလအတွင်း Top 5 - တွက်ချက်မှု အမှတ်စဉ်အရ)</Text>
      </View>
      {townships.map(([name, score], index) => (
        <View key={name} style={styles.item}>
          <View style={styles.itemHeader}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.score}>{score}</Text>
          </View>
          <View style={styles.barBg}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${(score / maxScore) * 100}%`,
                  backgroundColor: index === 0 ? '#eb3b5a' : index < 3 ? '#e67e22' : '#f7b731',
                },
              ]}
            />
          </View>
        </View>
      ))}
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
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#eb3b5a',
  },
  subtitle: {
    fontSize: 11,
    color: '#a4b0be',
    marginTop: 4,
  },
  item: {
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rank: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f7b731',
    width: 28,
  },
  name: {
    fontSize: 14,
    color: '#ffffff',
    flex: 1,
  },
  score: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  barBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
    marginLeft: 28,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
});
