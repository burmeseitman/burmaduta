import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, SafeAreaView, Dimensions,
} from 'react-native';
import { FilterState } from '../services/types';

const REGIONS = [
  'All', 'ရန်ကုန်', 'မန္တလေး', 'စစ်ကိုင်း', 'ပဲခူး', 'မကွေး',
  'ဧရာဝတီ', 'တနင်္သာရီ', 'နေပြည်တော်', 'ရှမ်း', 'ကချင်',
  'ကယား', 'ကရင်', 'ချင်း', 'မွန်', 'ရခိုင်',
];

const CATEGORIES = [
  'All', 'စစ်ရေးသတင်း', 'မှုခင်းသတင်း', 'မတော်တဆဖြစ်မှု',
  'သဘာဝဘေးအန္တရာယ်', 'အထွေထွေ',
];

function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

interface Props {
  filters: FilterState;
  onRegionChange: (region: string) => void;
  onCategoryChange: (category: string) => void;
  onDateChange: (date: string) => void;
}

type ModalType = 'region' | 'category' | 'date' | null;

export default function FilterBar({ filters, onRegionChange, onCategoryChange, onDateChange }: Props) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const renderModal = () => {
    let title = '';
    let options: string[] = [];
    let selected = '';
    let onSelect: (val: string) => void = () => {};

    switch (activeModal) {
      case 'region':
        title = 'တိုင်း/ပြည်နယ် ရွေးပါ';
        options = REGIONS;
        selected = filters.region;
        onSelect = (val) => { onRegionChange(val); setActiveModal(null); };
        break;
      case 'category':
        title = 'အမျိုးအစား ရွေးပါ';
        options = CATEGORIES;
        selected = filters.category;
        onSelect = (val) => { onCategoryChange(val); setActiveModal(null); };
        break;
      case 'date':
        title = 'ရက်စွဲ ရွေးပါ';
        options = getLast30Days();
        selected = filters.date;
        onSelect = (val) => { onDateChange(val); setActiveModal(null); };
        break;
      default:
        return null;
    }

    return (
      <Modal visible={true} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.optionsList}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.optionItem,
                    selected === opt && styles.optionItemActive,
                  ]}
                  onPress={() => onSelect(opt)}
                >
                  <Text style={[
                    styles.optionText,
                    selected === opt && styles.optionTextActive,
                  ]}>
                    {activeModal === 'date' ? formatShortDate(opt) : (opt === 'All' ? 'အားလုံး' : opt)}
                  </Text>
                  {selected === opt && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.filterBtn, filters.region !== 'All' && styles.filterBtnActive]}
        onPress={() => setActiveModal('region')}
      >
        <Text style={styles.filterLabel}>🗺️</Text>
        <Text style={styles.filterValue} numberOfLines={1}>
          {filters.region === 'All' ? 'အားလုံး' : filters.region}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterBtn, filters.category !== 'All' && styles.filterBtnActive]}
        onPress={() => setActiveModal('category')}
      >
        <Text style={styles.filterLabel}>📂</Text>
        <Text style={styles.filterValue} numberOfLines={1}>
          {filters.category === 'All' ? 'အားလုံး' : filters.category}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterBtn, styles.filterBtnActive]}
        onPress={() => setActiveModal('date')}
      >
        <Text style={styles.filterLabel}>📅</Text>
        <Text style={styles.filterValue} numberOfLines={1}>
          {formatShortDate(filters.date)}
        </Text>
      </TouchableOpacity>

      {renderModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20, 20, 25, 0.85)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterBtnActive: {
    borderColor: 'rgba(247, 183, 49, 0.3)',
    backgroundColor: 'rgba(247, 183, 49, 0.08)',
  },
  filterLabel: {
    fontSize: 14,
  },
  filterValue: {
    fontSize: 12,
    color: '#ffffff',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1f',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeBtn: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.5)',
    padding: 4,
  },
  optionsList: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  optionItemActive: {
    backgroundColor: 'rgba(247, 183, 49, 0.1)',
    borderRadius: 8,
  },
  optionText: {
    fontSize: 16,
    color: '#ffffff',
  },
  optionTextActive: {
    color: '#f7b731',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#f7b731',
    fontWeight: '700',
  },
});
