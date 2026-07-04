export interface RegionCoord {
  name: string;
  nameMM: string;
  center: { latitude: number; longitude: number };
  latDelta: number;
  lngDelta: number;
}

export const REGIONS: RegionCoord[] = [
  { name: 'All', nameMM: 'အားလုံး', center: { latitude: 19.7633, longitude: 96.0785 }, latDelta: 12, lngDelta: 8 },
  { name: 'Yangon', nameMM: 'ရန်ကုန်', center: { latitude: 16.8661, longitude: 96.1951 }, latDelta: 1, lngDelta: 1 },
  { name: 'Mandalay', nameMM: 'မန္တလေး', center: { latitude: 21.9162, longitude: 96.0898 }, latDelta: 1, lngDelta: 1 },
  { name: 'Sagaing', nameMM: 'စစ်ကိုင်း', center: { latitude: 22.8775, longitude: 95.4402 }, latDelta: 3, lngDelta: 2 },
  { name: 'Bago', nameMM: 'ပဲခူး', center: { latitude: 17.3304, longitude: 96.4814 }, latDelta: 2, lngDelta: 1.5 },
  { name: 'Magway', nameMM: 'မကွေး', center: { latitude: 20.1544, longitude: 94.9455 }, latDelta: 3, lngDelta: 2 },
  { name: 'Ayeyarwady', nameMM: 'ဧရာဝတီ', center: { latitude: 17.0341, longitude: 94.9455 }, latDelta: 3, lngDelta: 2 },
  { name: 'Tanintharyi', nameMM: 'တနင်္သာရီ', center: { latitude: 13.2925, longitude: 98.7118 }, latDelta: 5, lngDelta: 3 },
  { name: 'Naypyidaw', nameMM: 'နေပြည်တော်', center: { latitude: 19.7633, longitude: 96.0785 }, latDelta: 0.5, lngDelta: 0.5 },
  { name: 'Shan', nameMM: 'ရှမ်း', center: { latitude: 21.1731, longitude: 98.0506 }, latDelta: 5, lngDelta: 3 },
  { name: 'Kachin', nameMM: 'ကချင်', center: { latitude: 25.4045, longitude: 97.4646 }, latDelta: 5, lngDelta: 3 },
  { name: 'Kayah', nameMM: 'ကယား', center: { latitude: 19.2342, longitude: 97.3323 }, latDelta: 2, lngDelta: 1.5 },
  { name: 'Kayin', nameMM: 'ကရင်', center: { latitude: 16.9425, longitude: 97.9593 }, latDelta: 3, lngDelta: 2 },
  { name: 'Chin', nameMM: 'ချင်း', center: { latitude: 22.0163, longitude: 93.6450 }, latDelta: 3, lngDelta: 2 },
  { name: 'Mon', nameMM: 'မွန်', center: { latitude: 16.1432, longitude: 97.7475 }, latDelta: 2, lngDelta: 1.5 },
  { name: 'Rakhine', nameMM: 'ရခိုင်', center: { latitude: 19.3400, longitude: 93.5300 }, latDelta: 5, lngDelta: 3 },
];

export const REGION_NAMES_MM = REGIONS.map(r => r.nameMM);

export const MYANMAR_CENTER = { latitude: 19.7633, longitude: 96.0785 };
export const MYANMAR_DELTA = { latitudeDelta: 12, longitudeDelta: 8 };
