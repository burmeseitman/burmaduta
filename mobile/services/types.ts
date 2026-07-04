export interface NewsItem {
  id: number;
  crime_type: string;
  sub_category: string | null;
  summary: string;
  raw_text: string;
  publish_date: string;
  time: string | null;
  township: string | null;
  city: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  people_involved: string | null;
  source_channel: string | null;
}

export interface FilterState {
  region: string;
  category: string;
  date: string;
  searchQuery: string;
}

export interface WeatherData {
  temp: number;
  icon: string;
  label: string;
}

export type CategoryKey = 'စစ်ရေးသတင်း' | 'မှုခင်းသတင်း' | 'မတော်တဆဖြစ်မှု' | 'သဘာဝဘေးအန္တရာယ်' | 'အထွေထွေ';
