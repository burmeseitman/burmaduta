import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = String(date.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = months[date.getMonth()];
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  } catch { return dateStr; }
}

function formatTime(timeStr: string | null): string {
  if (!timeStr || timeStr === 'မသိရ') return '';
  try {
    const parts = timeStr.split(':');
    let hours = parseInt(parts[0]);
    if (isNaN(hours)) return timeStr;
    const minutes = String(parts[1] || '00').substring(0, 2);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  } catch { return timeStr; }
}

interface Props {
  item: NewsItem;
  onPress?: (item: NewsItem) => void;
}

const NewsCard = memo(function NewsCard({ item, onPress }: Props) {
  const color = categoryColors[item.crime_type] || '#7f8c8d';
  const icon = categoryIcons[item.crime_type] || '📍';
  const location = [item.township, item.city].filter(Boolean).join(', ');
  const timeDisplay = formatTime(item.time);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.accentBar, { backgroundColor: color }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.category, { color }]}>{item.crime_type}</Text>
          {item.sub_category && (
            <Text style={styles.subCategory}>{item.sub_category}</Text>
          )}
        </View>
        <Text style={styles.summary} numberOfLines={3}>
          {item.summary || item.raw_text}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.location}>📍 {location || item.region || 'Unknown'}</Text>
          <View style={styles.dateTime}>
            <Text style={styles.date}>{formatDate(item.publish_date)}</Text>
            {timeDisplay ? <Text style={styles.time}>{timeDisplay}</Text> : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default NewsCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1f',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  category: {
    fontSize: 13,
    fontWeight: '600',
  },
  subCategory: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginLeft: 'auto',
  },
  summary: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  location: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    flex: 1,
  },
  dateTime: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  date: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  time: {
    fontSize: 11,
    color: '#f7b731',
  },
});
