import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNews } from '../../hooks/useNews';
import { useFilters } from '../../hooks/useFilters';
import SearchBar from '../../components/SearchBar';
import CategoryChips from '../../components/CategoryChips';
import AlertCard from '../../components/AlertCard';
import LoadingScreen from '../../components/LoadingScreen';
import WeatherWidget from '../../components/WeatherWidget';
import { MYANMAR_CENTER, MYANMAR_DELTA } from '../../constants/regions';

const mapCustomStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
];

export default function MapScreen() {
  const { news, loading } = useNews();
  const {
    filters,
    setRegion,
    setCategory,
    setDate,
    setSearchQuery,
    mappableNews,
  } = useFilters(news);

  const mapRef = useRef<MapView>(null);

  if (loading && news.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* The Map spans the entire background */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          ...MYANMAR_CENTER,
          ...MYANMAR_DELTA,
        }}
        pitchEnabled={true}
        rotateEnabled={true}
        zoomEnabled={true}
        scrollEnabled={true}
      >
        {mappableNews.map((item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.lat!, longitude: item.lng! }}
            pinColor={item.crime_type === 'စစ်ရေးသတင်း' ? '#e74c3c' : '#f7b731'}
          >
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{item.crime_type}</Text>
                {item.sub_category && <Text style={styles.calloutSub}>{item.sub_category}</Text>}
                <Text style={styles.calloutText}>{item.summary || item.township}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Floating Header UI */}
      <SafeAreaView style={styles.floatingHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.logo}>ဗမာဒူတ</Text>
          <WeatherWidget />
        </View>
        <SearchBar 
          value={filters.searchQuery} 
          onChangeText={setSearchQuery} 
        />
        <CategoryChips
          selectedCategory={filters.category}
          onCategoryChange={setCategory}
          selectedRegion={filters.region}
          onRegionChange={setRegion}
          selectedDate={filters.date}
          onDateChange={setDate}
        />
      </SafeAreaView>
      
      {/* Bottom Alert Card */}
      <AlertCard news={mappableNews} />

      {/* Recenter Button */}
      <TouchableOpacity 
        style={styles.recenterBtn}
        onPress={() => mapRef.current?.animateToRegion({ ...MYANMAR_CENTER, ...MYANMAR_DELTA }, 1000)}
      >
        <Text style={styles.recenterIcon}>🎯</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0b',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'android' ? 40 : 0,
    paddingBottom: 16,
    backgroundColor: 'rgba(10, 10, 11, 0.4)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f7b731',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  callout: {
    backgroundColor: 'rgba(20, 20, 25, 0.95)',
    padding: 12,
    borderRadius: 8,
    width: 220,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  calloutTitle: {
    color: '#eb3b5a',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  calloutSub: {
    color: '#f7b731',
    fontSize: 12,
    marginBottom: 4,
  },
  calloutText: {
    color: '#ffffff',
    fontSize: 12,
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 180, // Moved up to not conflict with AlertCard
    right: 20,
    backgroundColor: 'rgba(20, 20, 25, 0.9)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  recenterIcon: {
    fontSize: 20,
  },
});
