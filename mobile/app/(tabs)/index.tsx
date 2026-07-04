import React, { useRef, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNews } from '../../hooks/useNews';
import { useFilters } from '../../hooks/useFilters';
import FilterBar from '../../components/FilterBar';
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
    mappableNews,
  } = useFilters(news);

  const mapRef = useRef<MapView>(null);

  if (loading && news.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.logo}>Burma Duta</Text>
          <WeatherWidget />
        </View>
        <FilterBar
          filters={filters}
          onRegionChange={setRegion}
          onCategoryChange={setCategory}
          onDateChange={setDate}
        />
      </View>

      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={{
          ...MYANMAR_CENTER,
          ...MYANMAR_DELTA,
        }}
        customMapStyle={mapCustomStyle}
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
      
      <TouchableOpacity 
        style={styles.recenterBtn}
        onPress={() => mapRef.current?.animateToRegion({ ...MYANMAR_CENTER, ...MYANMAR_DELTA }, 1000)}
      >
        <Text style={styles.recenterIcon}>🎯</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0b',
  },
  header: {
    paddingTop: 50,
    backgroundColor: 'rgba(10, 10, 11, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f7b731',
    letterSpacing: 1,
  },
  map: {
    flex: 1,
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
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(20, 20, 25, 0.9)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  recenterIcon: {
    fontSize: 20,
  },
});
