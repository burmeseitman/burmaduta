// Initialize Leaflet Map (Myanmar Centered)
const map = L.map("map", {
  zoomControl: false,
}).setView([19.7633, 96.0785], 6);

// Dark Layer (OpenStreetMap Carto Dark)
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; CartoDB & OpenStreetMap contributors",
}).addTo(map);

// Move zoom control to bottom right
L.control.zoom({ position: "bottomright" }).addTo(map);

// Global State
let allNewsItems = [];
let currentFilter = "All";
let searchQuery = "";
const markers = {};
const typeColors = {
  တိုက်ပွဲသတင်း: "#8e44ad",
  မှုခင်းသတင်း: "#eb3b5a",
  မတော်တဆဖြစ်မှု: "#fa8231",
  သဘာဝဘေးအန္တရာယ်: "#2980b9",
  "အထွေထွေနှင့် ဝန်ဆောင်မှု": "#4b6584",
  Other: "#4b6584",
};

const typeIcons = {
  တိုက်ပွဲသတင်း: "⚔️",
  မှုခင်းသတင်း: "🚨",
  မတော်တဆဖြစ်မှု: "⚠️",
  သဘာဝဘေးအန္တရာယ်: "🌊",
  "အထွေထွေနှင့် ဝန်ဆောင်မှု": "ℹ️",
  Other: "📍",
};


const newsFeed = document.getElementById("news-feed");
const totalCountEl = document.getElementById("total-count");
const latestTypeEl = document.getElementById("latest-type");
const searchInput = document.getElementById("search-input");
const categoryFiltersEl = document.getElementById("category-filters");

async function fetchNews() {
  try {
    const response = await fetch("/api/news");
    const data = await response.json();
    allNewsItems = data;
    updateUI();
  } catch (error) {
    console.error("Error fetching news:", error);
    newsFeed.innerHTML = '<p class="status">Failed to connect to backend.</p>';
  }
}

function updateUI() {
  const filtered = allNewsItems.filter((item) => {
    const matchesType =
      currentFilter === "All" || item.crime_type === currentFilter;
    const matchesSearch =
      !searchQuery ||
      (item.summary &&
        item.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.location_name &&
        item.location_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  updateStats(allNewsItems);
  updateFilters(allNewsItems);
  renderNewsFeed(filtered);
  updateMapMarkers(filtered);
  lucide.createIcons();
}

function updateStats(items) {
  if (items.length === 0) return;
  totalCountEl.innerText = items.length;
  latestTypeEl.innerText = items[0].crime_type || "Unknown";
}

function updateFilters(items) {
  const types = [
    "All",
    ...new Set(items.map((i) => i.crime_type).filter(Boolean)),
  ];
  categoryFiltersEl.innerHTML = "";
  types.forEach((type) => {
    const chip = document.createElement("div");
    chip.className = `filter-chip ${currentFilter === type ? "active" : ""}`;
    chip.innerText = type;
    chip.onclick = () => {
      currentFilter = type;
      updateUI();
    };
    categoryFiltersEl.appendChild(chip);
  });
}

function renderNewsFeed(items) {
  if (items.length === 0) {
    newsFeed.innerHTML = '<p class="status">No matching events found.</p>';
    return;
  }

  newsFeed.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "news-card";
    const typeLabel = item.crime_type || "Other";
    const typeClass = `type-${typeLabel.replace(/\s+/g, "-")}`;

    card.innerHTML = `
            <span class="type-tag ${typeClass}">${item.crime_type || "Other"}</span>
            <h3>${item.summary || "No description available"}</h3>
            <div class="news-meta">
                <span><i data-lucide="map-pin" style="width:12px"></i> ${item.location_name || "Myanmar"}</span>
                <span><i data-lucide="calendar" style="width:12px"></i> ${item.event_date || item.publish_date || "N/A"}</span>
                <span class="source-tag">${item.channel_handle || ""}</span>
            </div>
        `;

    card.onclick = () => {
      if (item.latitude && item.longitude) {
        map.flyTo([item.latitude, item.longitude], 14, { duration: 1.5 });
        markers[item.id]?.openPopup();
      }
    };

    newsFeed.appendChild(card);
  });
}

function updateMapMarkers(items) {
  // Hide all markers first or remove existing
  Object.values(markers).forEach((m) => map.removeLayer(m));

  items.forEach((item) => {
    if (item.latitude && item.longitude) {
      const color = typeColors[item.crime_type] || typeColors["Other"];
      const icon = typeIcons[item.crime_type] || typeIcons["Other"];

      const customIcon = L.divIcon({
        html: `<div style="background-color:${color}; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #fff; font-size:16px;">${icon}</div>`,
        className: "custom-div-icon",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([item.latitude, item.longitude], {
        icon: customIcon,
      }).addTo(map);

      const typeLabel = item.crime_type || "Other";
      const typeClass = `type-${typeLabel.split(" ").join("-")}`;


      marker.bindPopup(
        `
                <div style="font-family: 'Inter', sans-serif; padding: 5px;">
                    <div class="type-tag ${typeClass}" style="margin-bottom:8px">${typeLabel}</div>
                    <strong style="display:block; margin-bottom:4px; font-size:14px;">${item.location_name}</strong>
                    <p style="font-size: 13px; color: #ccc; margin-bottom:8px;">${item.summary}</p>
                    <div style="font-size: 11px; opacity: 0.6; display:flex; justify-content:space-between; margin-top:8px;">
                        <span>📅 Event: ${item.event_date || "N/A"}</span>
                        <span>⏰ Time: ${item.event_time || "N/A"}</span>
                    </div>
                    <div style="font-size: 10px; opacity: 0.4; margin-top:4px;">
                        <span>Source: ${item.channel_handle || "Unknown"} | Published: ${item.publish_date}</span>
                    </div>
                </div>
            `,
        { maxWidth: 250 },
      );

      markers[item.id] = marker;
    }
  });
}

// Event Listeners
searchInput.oninput = (e) => {
  searchQuery = e.target.value;
  updateUI();
};

// Polling
fetchNews();
setInterval(fetchNews, 30000); // 30 seconds for dashboard stability
lucide.createIcons();
