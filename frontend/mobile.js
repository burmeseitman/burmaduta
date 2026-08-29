// API Configuration - Injected at build time
const API_BASE_URL = '__INJECT_API_BASE_URL__';
const API_KEY = '__INJECT_API_KEY__';
const API_URL = `${API_BASE_URL}/api/news`;

let map;
let markers;
let heatLayer = null;
let allNews = [];
let filteredNews = [];

let currentFilters = {
  region: 'All',
  category: 'All',
  date: getLocalDateString(), // Show today by default
  search: ''
};

// Elements
const loadingOverlay = document.getElementById('loading-overlay');
const alertCard = document.getElementById('alert-card');
const recenterBtn = document.getElementById('recenter-btn');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const heatmapToggleBtn = document.getElementById('heatmap-toggle');

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

const typeColors = {
  စစ်ရေးသတင်း: "#e74c3c",
  မှုခင်းသတင်း: "#9b59b6",
  မတော်တဆဖြစ်မှု: "#f1c40f",
  သဘာဝဘေးအန္တရာယ်: "#e67e22",
  အထွေထွေ: "#3498db",
  Other: "#7f8c8d",
};

const typeIcons = {
  စစ်ရေးသတင်း: "⚔️",
  မှုခင်းသတင်း: "🚨",
  မတော်တဆဖြစ်မှု: "⚠️",
  သဘာဝဘေးအန္တရာယ်: "🌊",
  အထွေထွေ: "ℹ️",
  Other: "📍",
};

function getLocalDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return 'ရက်စွဲ (အားလုံး)';
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getLast30Days() {
  const days = ['']; // Empty string for 'All'
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  return days;
}

function renderAgentBadges(item) {
  if (!item) return '';
  let badges = '';
  if (item.priority_level === 'CRITICAL_EMERGENCY') {
    badges += `<span class="agent-badge badge-priority-critical">🚨 အရေးပေါ်</span>`;
  }
  if (item.fact_check_verdict === 'VERIFIED') {
    const score = item.credibility_score ? Math.round(item.credibility_score * 100) : 90;
    badges += `<span class="agent-badge badge-verified">✓ စိစစ်ပြီး (${score}%)</span>`;
  } else if (item.fact_check_verdict === 'PLAUSIBLE') {
    badges += `<span class="agent-badge badge-plausible">~ ဖြစ်နိုင်ခြေရှိ</span>`;
  } else if (item.fact_check_verdict === 'FAKE_NEWS' || item.fact_check_verdict === 'SPAM') {
    badges += `<span class="agent-badge badge-fake">✕ သတင်းမှား</span>`;
  }
  return badges ? `<div class="agent-badge-row">${badges}</div>` : '';
}

function initMap() {
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView(MYANMAR_CENTER, ZOOM_LEVEL);

  // Dark Map Style (ESRI World Dark Gray - No API Key & No Watermark)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16
  }).addTo(map);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16
  }).addTo(map);

  markers = L.markerClusterGroup({
    maxClusterRadius: 40,
    iconCreateFunction: function (cluster) {
      const count = cluster.getChildCount();
      return L.divIcon({
        html: `<div style="background-color: rgba(247, 183, 49, 0.9); color: #000; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px;">${count}</div>`,
        className: 'custom-cluster-icon',
        iconSize: L.point(28, 28)
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
    const res = await fetch(`${API_URL}?days=30&minimal=true&limit=10000`, {
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
    if (!item.latitude || !item.longitude) return false;

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
  updateCriticalList();
}

function renderMap() {
  markers.clearLayers();
  
  filteredNews.forEach(item => {
    const color = typeColors[item.crime_type] || typeColors.Other;
    const iconStr = typeIcons[item.crime_type] || typeIcons.Other;
    
    // Identify aircraft/airstrike for radar animation
    let isAirstrike = item.sub_category && item.sub_category.includes("လေကြောင်းတိုက်ခိုက်မှု");
    let isAirAlert = item.sub_category && (item.sub_category.includes("လေယာဉ်သတိပေးချက်") || item.sub_category.includes("လေကြောင်းသတိပေးချက်") || item.sub_category === "လေကြောင်း" || item.sub_category.includes("လေယာဉ်"));
    let isAircraft = isAirstrike || isAirAlert;
    let customIconHtml = '';

    if (isAircraft) {
      let rotation = 45; // Default flight direction
      if (item.raw_text) {
        const text = item.raw_text;
        let h = null;
        if (text.includes("မြောက်")) h = text.includes("အရှေ့") ? "northeast" : text.includes("အနောက်") ? "northwest" : "north";
        else if (text.includes("တောင်")) h = text.includes("အရှေ့") ? "southeast" : text.includes("အနောက်") ? "southwest" : "south";
        else if (text.includes("အရှေ့")) h = "east";
        else if (text.includes("အနောက်")) h = "west";

        const rotMap = { "north": -45, "south": 135, "east": 45, "west": 225, "northeast": 0, "northwest": -90, "southeast": 90, "southwest": 180 };
        if (rotMap[h] !== undefined) rotation = rotMap[h];
      }

      const radarClass = isAirAlert ? "radar-ping alert" : "radar-ping";
      const bgColor = isAirAlert ? "#f39c12" : "#c0392b";
      const shadowColor = isAirAlert ? "rgba(243, 156, 18, 0.8)" : "rgba(192, 57, 43, 0.8)";

      customIconHtml = `
      <div class="map-marker-container radar-container" style="width:24px; height:24px;">
          <div class="${radarClass}"></div>
          <div style="background-color:${bgColor}; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1.5px solid #fff; font-size:12px; position:relative; z-index:2; box-shadow: 0 0 10px ${shadowColor};">
              <span style="transform: rotate(${rotation}deg); display: inline-block;">✈️</span>
          </div>
      </div>`;
    } else {
      customIconHtml = `
      <div class="map-marker-container" style="width:24px; height:24px;">
          <div class="pulse-ring" style="background-color:${color};"></div>
          <div style="background-color:${color}; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1.5px solid #fff; font-size:12px; position:relative; z-index:2;">
              ${iconStr}
          </div>
      </div>`;
    }
    
    const icon = L.divIcon({
      className: 'custom-marker',
      html: customIconHtml,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const popupContent = `
      <div class="popup-title">${item.crime_type}</div>
      ${item.sub_category ? `<div class="popup-sub">${item.sub_category}</div>` : ''}
      ${renderAgentBadges(item)}
      <p class="popup-text">${item.summary || item.township}</p>
    `;

    L.marker([item.latitude, item.longitude], { icon })
      .bindPopup(popupContent)
      .addTo(markers);
  });

  if (heatmapToggleBtn.classList.contains('active')) {
    if (heatLayer) map.removeLayer(heatLayer);
    const heatData = filteredNews.map(i => [parseFloat(i.latitude), parseFloat(i.longitude), 0.8]);
    heatLayer = L.heatLayer(heatData, {
      radius: 35,
      blur: 20,
      maxZoom: 14,
      minOpacity: 0.4,
      gradient: { 0.4: 'blue', 0.6: 'lime', 1: 'yellow' }
    });
    map.addLayer(heatLayer);
  } else {
    if (heatLayer) {
      map.removeLayer(heatLayer);
      heatLayer = null;
    }
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let currentCriticalItem = null;

function openAlertDetails(item) {
  if (!item) return;

  if (item.latitude && item.longitude) {
    map.setView([item.latitude, item.longitude], 13, { animate: true });
  }

  const isAir = (item.sub_category || '').includes('လေကြောင်း') || (item.emergency_type === 'airstrike');
  const title = item.heading || item.crime_type || (isAir ? 'လေကြောင်းရန် သတိပေးချက်' : 'အရေးပေါ် သတိပေးချက်');

  modalTitle.innerText = title;
  modalBody.innerHTML = `
    <div style="padding: 6px 0; color: #fff;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 0.8rem; color: #ff4757; font-weight: bold; background: rgba(255,71,87,0.15); padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(255,71,87,0.3);">
          🚨 ${escapeHTML(item.crime_type || 'အရေးပေါ်')} ${item.sub_category ? `• ${escapeHTML(item.sub_category)}` : ''}
        </span>
      </div>
      ${renderAgentBadges(item)}
      <div style="font-size: 0.92rem; line-height: 1.6; margin: 14px 0; color: #e2e8f0; word-break: break-word;">
        ${escapeHTML(item.summary || item.raw_text || '')}
      </div>
      <div style="font-size: 0.8rem; color: #a4b0be; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: 14px; display: flex; flex-direction: column; gap: 4px;">
        <div>📍 <strong>တည်နေရာ:</strong> ${escapeHTML(item.township || item.city || item.region || 'မြန်မာ')}</div>
        <div>🕒 <strong>အချိန်:</strong> ${escapeHTML(item.publish_date || '')} ${escapeHTML(item.publish_time || '')}</div>
        ${item.channel_handle ? `<div>📡 <strong>သတင်းရင်းမြစ်:</strong> ${escapeHTML(item.channel_handle)}</div>` : ''}
      </div>
      <button id="modal-zoom-btn" style="width: 100%; margin-top: 16px; padding: 12px; background: linear-gradient(135deg, #ff4757, #eb3b5a); color: #fff; border: none; border-radius: 10px; font-weight: bold; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
        📍 မြေပုံတွင် ကြည့်ရှုပါ
      </button>
    </div>
  `;

  const zoomBtn = document.getElementById('modal-zoom-btn');
  if (zoomBtn) {
    zoomBtn.onclick = () => {
      modalOverlay.classList.add('hidden');
      if (item.latitude && item.longitude) {
        map.setView([item.latitude, item.longitude], 13, { animate: true });
      }
    };
  }

  modalOverlay.classList.remove('hidden');
}

alertCard.addEventListener('click', () => {
  if (currentCriticalItem) openAlertDetails(currentCriticalItem);
});

function checkAlerts() {
  const critical = filteredNews.find(item => {
    if (item.is_emergency_alert || item.priority_level === 'CRITICAL_EMERGENCY') return true;
    const text = `${item.sub_category||''} ${item.summary||''} ${item.raw_text||''}`;
    return text.includes('လေကြောင်းရန်') || text.includes('မြေငလျင်') || text.includes('မြေပြို');
  });

  currentCriticalItem = critical;

  if (critical) {
    const isAir = (critical.sub_category||'').includes('လေကြောင်း') || (critical.emergency_type === 'airstrike');
    let title = '⚠️ အရေးပေါ် သတိပေးချက်';
    if (isAir) title = '⚠️ လေကြောင်းရန် သတိပေးချက်';
    else if (critical.emergency_type === 'landslide') title = '⚠️ မြေပြိုကျမှု သတိပေးချက်';
    else if (critical.emergency_type === 'flood') title = '⚠️ ရေကြီးရေလျှံမှု သတိပေးချက်';
    else if (critical.emergency_type === 'earthquake') title = '⚠️ မြေငလျင် သတိပေးချက်';

    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-title').style.color = '#ff4757';
    document.querySelector('.pulse-indicator').style.backgroundColor = '#ff4757';
    document.querySelector('.pulse-indicator').style.boxShadow = `0 0 8px #ff4757`;
    
    document.getElementById('alert-desc').innerText = critical.heading || critical.summary || critical.raw_text;
    document.getElementById('alert-time').innerText = `${critical.publish_date} ${critical.publish_time||''}`;
    
    alertCard.classList.remove('hidden');
    document.body.classList.add('alert-visible');
  } else {
    alertCard.classList.add('hidden');
    document.body.classList.remove('alert-visible');
  }
}

function updateCriticalList() {
  const critical = allNews.filter(item => {
    const hasLocation = item.township || item.city || item.region;
    if (!hasLocation) return false;
    
    const text = `${item.sub_category||''} ${item.summary||''} ${item.raw_text||''}`;
    const isAir = text.includes('လေကြောင်း') || text.includes('လေယာဉ်');
    const isEarthquake = text.includes('ငလျင်');
    const isDisaster = item.crime_type === 'သဘာဝဘေးအန္တရာယ်';
    return isAir || isEarthquake || isDisaster;
  });
  
  critical.sort((a, b) => new Date(b.publish_date) - new Date(a.publish_date));
  const top5 = critical.slice(0, 5);
  
  const container = document.getElementById('latest-critical-list');
  const itemsContainer = document.getElementById('critical-list-items');
  
  if (top5.length > 0) {
    container.classList.remove('hidden');
    itemsContainer.innerHTML = '';
    
    top5.forEach(item => {
      const text = `${item.sub_category||''} ${item.summary||''} ${item.raw_text||''}`;
      const isAir = text.includes('လေကြောင်း') || text.includes('လေယာဉ်');
      
      const icon = isAir ? '✈️' : '🌊';
      const color = isAir ? '#ff4757' : '#ffa502';
      
      const div = document.createElement('div');
      div.className = 'critical-item';
      
      const dateStr = (item.publish_date || '').split('T')[0];
      const timeStr = dateStr ? dateStr.slice(-5) : '';
      
      const locationName = item.township || item.city || item.region;
      const displayTitle = locationName ? locationName : (item.sub_category || item.summary || 'သတင်း');
      
      div.innerHTML = `
        <div class="critical-item-icon" style="color: ${color};">${icon}</div>
        <div class="critical-item-text" title="${displayTitle}">${displayTitle}</div>
        <div class="critical-item-time">${timeStr}</div>
      `;
      
      div.onclick = () => {
        openAlertDetails(item);
      };
      
      itemsContainer.appendChild(div);
    });
  } else {
    container.classList.add('hidden');
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

heatmapToggleBtn.addEventListener('click', () => {
  heatmapToggleBtn.classList.toggle('active');
  renderMap();
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

// Initialize on load
dateChipText.innerText = formatShortDate(currentFilters.date);
initMap();
fetchNews();
setInterval(fetchNews, 60000); // Live refresh every 60 seconds
