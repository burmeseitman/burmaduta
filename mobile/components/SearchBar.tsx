import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChangeText, placeholder = "Search incidents or locations..." }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.searchIconContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255, 255, 255, 0.4)"
        selectionColor="#f7b731"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearBtn}>
          <Text style={styles.clearText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 25, 30, 0.75)',
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  searchIconContainer: {
    marginRight: 10,
  },
  searchIcon: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    height: '100%',
  },
  clearBtn: {
    padding: 8,
  },
  clearText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
  },
});
