import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NewsItem } from '../services/types';

interface Props {
  news: NewsItem[];
}

export default function TrendChart({ news }: Props) {
  const dailyCounts = useMemo(() => {
    const days: { date: string; label: string; count: number; isToday: boolean }[] = [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      const label = `${d.getDate()}\n${months[d.getMonth()]}`;

      const count = news.filter(item => {
        const itemDate = (item.publish_date || '').toString().split('T')[0].split(' ')[0];
        return itemDate === dateStr;
      }).length;

      days.push({ date: dateStr, label, count, isToday: dateStr === todayStr });
    }
    return days;
  }, [news]);

  const maxCount = Math.max(...dailyCounts.map(d => d.count), 1);
  const BAR_HEIGHT = 120;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>အချိန်အလိုက် ဖြစ်စဉ်များ</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartArea}
      >
        {dailyCounts.map((day) => {
          const barH = Math.max((day.count / maxCount) * BAR_HEIGHT, 2);
          return (
            <View key={day.date} style={styles.barColumn}>
              <Text style={styles.countLabel}>{day.count > 0 ? day.count : ''}</Text>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barH,
                      backgroundColor: day.isToday ? '#eb3b5a' : '#f7b731',
                      opacity: day.isToday ? 1 : 0.7,
                    },
                  ]}
                />
              </View>
              <Text style={[
                styles.dateLabel,
                day.isToday && styles.dateLabelToday,
              ]}>
                {day.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
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
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 4,
  },
  barColumn: {
    alignItems: 'center',
    width: 36,
    marginHorizontal: 2,
  },
  countLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 4,
    fontWeight: '600',
  },
  barWrapper: {
    height: 120,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 16,
    borderRadius: 4,
    minHeight: 2,
  },
  dateLabel: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 12,
  },
  dateLabelToday: {
    color: '#eb3b5a',
    fontWeight: '700',
  },
});
