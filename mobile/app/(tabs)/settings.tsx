import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkHealth } from '../../services/api';
import { Colors } from '../../constants/colors';

export default function SettingsScreen() {
  const [apiStatus, setApiStatus] = useState<boolean | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    checkHealth().then(setApiStatus);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ဆက်တင်</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>အက်ပလီကေးရှင်း အချက်အလက်</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Burma Duta Mobile</Text>
            <Text style={styles.value}>v1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>API ချိတ်ဆက်မှု</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.dot, { backgroundColor: apiStatus ? Colors.success : Colors.danger }]} />
              <Text style={styles.statusText}>{apiStatus ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>အသိပေးချက်များ (Notifications)</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.labelGroup}>
              <Text style={styles.label}>Aircraft Alerts (Coming Soon)</Text>
              <Text style={styles.subLabel}>လေကြောင်းအန္တရာယ် သတိပေးချက်များ</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#3e3e3e', true: 'rgba(247, 183, 49, 0.5)' }}
              thumbColor={notificationsEnabled ? Colors.primary : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ဒေတာ (Data)</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.labelGroup}>
              <Text style={styles.label}>Offline Caching (Beta)</Text>
              <Text style={styles.subLabel}>အင်တာနက်မရှိဘဲ သုံးရန်</Text>
            </View>
            <Switch
              value={offlineMode}
              onValueChange={setOfflineMode}
              trackColor={{ false: '#3e3e3e', true: 'rgba(235, 59, 90, 0.5)' }}
              thumbColor={offlineMode ? Colors.accent : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.aboutBtn}>
        <Text style={styles.aboutBtnText}>Burma Duta အကြောင်း</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgDark,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.glassBorder,
    marginLeft: 16,
  },
  labelGroup: {
    flex: 1,
    paddingRight: 16,
  },
  label: {
    fontSize: 15,
    color: '#ffffff',
  },
  subLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  value: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
  },
  aboutBtn: {
    marginHorizontal: 16,
    marginTop: 'auto',
    marginBottom: 30,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  aboutBtnText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
