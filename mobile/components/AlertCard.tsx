import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { NewsItem } from '../services/types';

interface AlertCardProps {
  news: NewsItem[];
}

export default function AlertCard({ news }: AlertCardProps) {
  // Find the most recent critical alert
  const criticalAlert = news.find(item => {
    const textToSearch = (item.sub_category || '') + (item.summary || '') + (item.raw_text || '');
    return textToSearch.includes('လေကြောင်းရန်') || textToSearch.includes('မြေငလျင်');
  });

  if (!criticalAlert) {
    return null; // Don't show if no critical alerts
  }

  const isAirAlert = (criticalAlert.sub_category || '').includes('လေကြောင်းရန်') || (criticalAlert.summary || '').includes('လေကြောင်းရန်');
  const alertTitle = isAirAlert ? '⚠️ လေကြောင်းရန် သတိပေးချက်' : '⚠️ မြေငလျင် သတိပေးချက်';
  const alertColor = isAirAlert ? '#ff4757' : '#ffa502';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: alertColor }]}>{alertTitle}</Text>
          <View style={[styles.pulseIndicator, { backgroundColor: alertColor }]} />
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {criticalAlert.summary || criticalAlert.raw_text}
        </Text>
        <View style={styles.footerRow}>
          <Text style={styles.timeAgo}>
            {criticalAlert.publish_date} {criticalAlert.time ? `• ${criticalAlert.time}` : ''}
          </Text>
          <TouchableOpacity>
            <Text style={styles.readMore}>READ FULL ALERT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(25, 25, 30, 0.85)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pulseIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  description: {
    color: '#rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeAgo: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  readMore: {
    color: '#f7b731',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
