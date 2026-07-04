import React, { useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CATEGORIES = [
  'All', 'စစ်ရေးသတင်း', 'မှုခင်းသတင်း', 'မတော်တဆဖြစ်မှု',
  'သဘာဝဘေးအန္တရာယ်', 'အထွေထွေ',
];

const REGIONS = [
  'All', 'ရန်ကုန်', 'မန္တလေး', 'စစ်ကိုင်း', 'ပဲခူး', 'မကွေး',
  'ဧရာဝတီ', 'တနင်္သာရီ', 'နေပြည်တော်', 'ရှမ်း', 'ကချင်',
  'ကယား', 'ကရင်', 'ချင်း', 'မွန်', 'ရခိုင်',
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
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

interface CategoryChipsProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export default function CategoryChips({
  selectedCategory, onCategoryChange,
  selectedRegion, onRegionChange,
  selectedDate, onDateChange
}: CategoryChipsProps) {
  const [activeModal, setActiveModal] = useState<'region' | 'date' | null>(null);

  const renderModal = () => {
    let title = '';
    let options: string[] = [];
    let selected = '';
    let onSelect: (val: string) => void = () => {};

    if (activeModal === 'region') {
      title = 'တိုင်း/ပြည်နယ် ရွေးပါ';
      options = REGIONS;
      selected = selectedRegion;
      onSelect = (val) => { onRegionChange(val); setActiveModal(null); };
    } else if (activeModal === 'date') {
      title = 'ရက်စွဲ ရွေးပါ';
      options = getLast30Days();
      selected = selectedDate;
      onSelect = (val) => { onDateChange(val); setActiveModal(null); };
    } else {
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
                  style={[styles.optionItem, selected === opt && styles.optionItemActive]}
                  onPress={() => onSelect(opt)}
                >
                  <Text style={[styles.optionText, selected === opt && styles.optionTextActive]}>
                    {activeModal === 'date' ? formatShortDate(opt) : (opt === 'All' ? 'ပြည်နယ်/တိုင်း' : opt)}
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Region Chip */}
        <TouchableOpacity
          style={[styles.chip, styles.modalChip, selectedRegion !== 'All' && styles.modalChipActive]}
          onPress={() => setActiveModal('region')}
        >
          <Text style={styles.chipEmoji}>🗺️</Text>
          <Text style={[styles.chipText, styles.chipTextActive]}>
            {selectedRegion === 'All' ? 'ပြည်နယ်/တိုင်း' : selectedRegion}
          </Text>
          <Text style={styles.dropdownIcon}>▼</Text>
        </TouchableOpacity>

        {/* Date Chip */}
        <TouchableOpacity
          style={[styles.chip, styles.modalChip, styles.modalChipActive]}
          onPress={() => setActiveModal('date')}
        >
          <Text style={styles.chipEmoji}>📅</Text>
          <Text style={[styles.chipText, styles.chipTextActive]}>
            {formatShortDate(selectedDate)}
          </Text>
          <Text style={styles.dropdownIcon}>▼</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Categories Chips */}
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
              onPress={() => onCategoryChange(cat)}
            >
              <Text style={[styles.chipText, isActive ? styles.chipTextActive : styles.chipTextInactive]}>
                {cat === 'All' ? 'သတင်း' : cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Visual cue for scrolling - Right fade */}
      <View style={styles.scrollFadeRight} pointerEvents="none" />
      
      {renderModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
  },
  modalChip: {
    backgroundColor: 'rgba(20, 20, 25, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalChipActive: {
    borderColor: 'rgba(247, 183, 49, 0.4)',
    backgroundColor: 'rgba(247, 183, 49, 0.1)',
  },
  chipActive: {
    backgroundColor: 'rgba(247, 183, 49, 0.15)',
    borderColor: 'rgba(247, 183, 49, 0.6)',
  },
  chipInactive: {
    backgroundColor: 'rgba(25, 25, 30, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipEmoji: {
    fontSize: 12,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#f7b731',
  },
  chipTextInactive: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  dropdownIcon: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    marginLeft: 6,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 4,
  },
  scrollFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 30,
    backgroundColor: 'transparent',
    // In React Native without linear-gradient, a simple transparent view won't fade.
    // For simplicity, we just rely on the user seeing partial chips clipped at the edge.
  },
  // Modal styles from previous FilterBar
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
