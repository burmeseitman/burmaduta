// API Configuration - Injected at build time
const API_BASE_URL = '__INJECT_API_BASE_URL__';
const API_KEY = '__INJECT_API_KEY__';
const API_URL = `${API_BASE_URL}/api/news`;

let map;
let markers;
let allNews = [];
let filteredNews = [];

let currentFilters = {
  region: 'All',
  category: 'All',
  date: getLocalDateString(),
  search: ''
};

// Elements
const loadingOverlay = document.getElementById('loading-overlay');
const alertCard = document.getElementById('alert-card');
const recenterBtn = document.getElementById('recenter-btn');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');

const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeModal = document.getElementById('close-modal');

const regionChip = document.getElementById('region-chip');
const regionChipText = document.getElementById('region-chip-text');
const dateChip = document.getElementById('date-chip');
const dateChipText = document.getElementById('date-chip-text');
const catChips = document.querySelectorAll('.cat-chip');

const MYANMAR_CENTER = [21.9162, 95.9560];
const ZOOM_LEVEL = 5;

// Constants
const REGIONS = [
  'All', 'ရန်ကုန်', 'မန္တလေး', 'စစ်ကိုင်း', 'ပဲခူး', 'မကွေး',
  'ဧရာဝတီ', 'တနင်္သာရီ', 'နေပြည်တော်', 'ရှမ်း', 'ကချင်',
  'ကယား', 'ကရင်', 'ချင်း', 'မွန်', 'ရခိုင်',
];

function getLocalDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getLast30Days() {
  const days = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  return days;
}

function initMap() {
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView(MYANMAR_CENTER, ZOOM_LEVEL);

  // Dark Map Style (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  markers = L.markerClusterGroup({
    maxClusterRadius: 40,
    iconCreateFunction: function (cluster) {
      const count = cluster.getChildCount();
      return L.divIcon({
        html: `<div style="background-color: rgba(247, 183, 49, 0.9); color: #000; border-radius: 50%; padding: 8px; font-weight: bold; text-align: center;">${count}</div>`,
        className: 'custom-cluster-icon',
        iconSize: L.point(40, 40)
      });
    }
  });

  map.addLayer(markers);
}

function normalizeCategory(raw) {
  const t = (raw || 'အထွေထွေ').trim();
  if (t.includes('စစ်ရေး') || t === 'တိုက်ပွဲသတင်း') return 'စစ်ရေးသတင်း';
  if (t.includes('မှုခင်း')) return 'မှုခင်းသတင်း';
  if (t.includes('မတော်တဆ') || t.includes('ယာဉ်တိုက်မှု')) return 'မတော်တဆဖြစ်မှု';
  if (t.includes('သဘာဝဘေး')) return 'သဘာဝဘေးအန္တရာယ်';
  return 'အထွေထွေ';
}

async function fetchNews() {
  try {
    const res = await fetch(`${API_URL}?days=30`, {
      headers: {
        'X-API-Key': API_KEY
      }
    });
    const data = await res.json();
    allNews = data.map(n => ({ ...n, crime_type: normalizeCategory(n.crime_type) }));
    applyFilters();
  } catch (e) {
    console.error(e);
  } finally {
    loadingOverlay.classList.add('hidden');
  }
}

function applyFilters() {
  filteredNews = allNews.filter(item => {
    // Has coordinates
    if (!item.lat || !item.lng) return false;

    // Date filter
    const itemDate = (item.publish_date || '').split('T')[0].split(' ')[0];
    if (currentFilters.date && itemDate !== currentFilters.date) return false;

    // Region filter
    if (currentFilters.region !== 'All') {
      const locStr = `${item.region || ''} ${item.city || ''} ${item.township || ''}`.toLowerCase();
      if (!locStr.includes(currentFilters.region.toLowerCase())) return false;
    }

    // Category filter
    if (currentFilters.category !== 'All' && item.crime_type !== currentFilters.category) return false;

    // Search filter
    if (currentFilters.search) {
      const text = `${item.summary||''} ${item.raw_text||''} ${item.township||''}`.toLowerCase();
      if (!text.includes(currentFilters.search)) return false;
    }

    return true;
  });

  renderMap();
  checkAlerts();
}

function renderMap() {
  markers.clearLayers();
  
  filteredNews.forEach(item => {
    const isMilitary = item.crime_type === 'စစ်ရေးသတင်း';
    const color = isMilitary ? '#e74c3c' : '#f7b731';
    
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="custom-marker-dot" style="background-color: ${color};"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const popupContent = `
      <div class="popup-title">${item.crime_type}</div>
      ${item.sub_category ? `<div class="popup-sub">${item.sub_category}</div>` : ''}
      <p class="popup-text">${item.summary || item.township}</p>
    `;

    L.marker([item.lat, item.lng], { icon })
      .bindPopup(popupContent)
      .addTo(markers);
  });
}

function checkAlerts() {
  const critical = filteredNews.find(item => {
    const text = `${item.sub_category||''} ${item.summary||''} ${item.raw_text||''}`;
    return text.includes('လေကြောင်းရန်') || text.includes('မြေငလျင်');
  });

  if (critical) {
    const isAir = (critical.sub_category||'').includes('လေကြောင်းရန်') || (critical.summary||'').includes('လေကြောင်းရန်');
    document.getElementById('alert-title').innerText = isAir ? '⚠️ လေကြောင်းရန် သတိပေးချက်' : '⚠️ မြေငလျင် သတိပေးချက်';
    document.getElementById('alert-title').style.color = isAir ? '#ff4757' : '#ffa502';
    document.querySelector('.pulse-indicator').style.backgroundColor = isAir ? '#ff4757' : '#ffa502';
    document.querySelector('.pulse-indicator').style.boxShadow = `0 0 8px ${isAir ? '#ff4757' : '#ffa502'}`;
    
    document.getElementById('alert-desc').innerText = critical.summary || critical.raw_text;
    document.getElementById('alert-time').innerText = `${critical.publish_date} ${critical.time||''}`;
    
    alertCard.classList.remove('hidden');
    document.body.classList.add('alert-visible'); // For recenter button positioning
  } else {
    alertCard.classList.add('hidden');
    document.body.classList.remove('alert-visible');
  }
}

// UI Event Listeners
searchInput.addEventListener('input', (e) => {
  currentFilters.search = e.target.value.toLowerCase();
  clearSearchBtn.style.display = currentFilters.search ? 'block' : 'none';
  applyFilters();
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  currentFilters.search = '';
  clearSearchBtn.style.display = 'none';
  applyFilters();
});

recenterBtn.addEventListener('click', () => {
  map.setView(MYANMAR_CENTER, ZOOM_LEVEL);
});

catChips.forEach(chip => {
  chip.addEventListener('click', () => {
    catChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilters.category = chip.dataset.category;
    applyFilters();
  });
});

// Modals
let activeModalType = null;

regionChip.addEventListener('click', () => openModal('region'));
dateChip.addEventListener('click', () => openModal('date'));
closeModal.addEventListener('click', () => modalOverlay.classList.add('hidden'));

function openModal(type) {
  activeModalType = type;
  modalTitle.innerText = type === 'region' ? 'တိုင်း/ပြည်နယ် ရွေးပါ' : 'ရက်စွဲ ရွေးပါ';
  modalBody.innerHTML = '';

  const options = type === 'region' ? REGIONS : getLast30Days();
  const currentVal = type === 'region' ? currentFilters.region : currentFilters.date;

  options.forEach(opt => {
    const div = document.createElement('div');
    div.className = `option-item ${currentVal === opt ? 'active' : ''}`;
    
    let display = opt;
    if (type === 'region' && opt === 'All') display = 'ပြည်နယ်/တိုင်း';
    if (type === 'date') display = formatShortDate(opt);
    
    div.innerText = display;
    
    div.addEventListener('click', () => {
      if (type === 'region') {
        currentFilters.region = opt;
        regionChipText.innerText = opt === 'All' ? 'ပြည်နယ်/တိုင်း' : opt;
      } else {
        currentFilters.date = opt;
        dateChipText.innerText = formatShortDate(opt);
      }
      modalOverlay.classList.add('hidden');
      applyFilters();
    });
    
    modalBody.appendChild(div);
  });

  modalOverlay.classList.remove('hidden');
}

// Weather Widget Placeholder
setTimeout(() => {
  document.getElementById('weather-temp').innerText = '32°C';
}, 1000);

// Init
dateChipText.innerText = formatShortDate(currentFilters.date);
initMap();
fetchNews();
