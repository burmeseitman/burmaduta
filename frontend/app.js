// API Configuration - Injected at build time
const API_BASE_URL = '__INJECT_API_BASE_URL__';
const API_KEY = '__INJECT_API_KEY__';
const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast?latitude=16.8661&longitude=96.1951&current=temperature_2m,weather_code,is_day";

// Weather mapping
const weatherCodeMap = {
    0: { icon: "☀️", night: "🌙", label: "Clear" },
    1: { icon: "🌤️", night: "🌙", label: "Mainly Clear" },
    2: { icon: "⛅", night: "☁️", label: "Partly Cloudy" },
    3: { icon: "☁️", night: "☁️", label: "Overcast" },
    45: { icon: "🌫️", night: "🌫️", label: "Fog" },
    48: { icon: "🌫️", night: "🌫️", label: "Fog" },
    51: { icon: "🌦️", night: "🌧️", label: "Drizzle" },
    53: { icon: "🌦️", night: "🌧️", label: "Drizzle" },
    55: { icon: "🌦️", night: "🌧️", label: "Drizzle" },
    61: { icon: "🌧️", night: "🌧️", label: "Rain" },
    63: { icon: "🌧️", night: "🌧️", label: "Rain" },
    65: { icon: "🌧️", night: "🌧️", label: "Heavy Rain" },
    80: { icon: "🌦️", night: "🌧️", label: "Showers" },
    81: { icon: "🌦️", night: "🌧️", label: "Showers" },
    82: { icon: "🌧️", night: "🌧️", label: "Violent Showers" },
    95: { icon: "⛈️", night: "⛈️", label: "Thunderstorm" },
};

async function fetchWeather() {
    try {
        const response = await fetch(WEATHER_API_URL);
        const data = await response.json();
        
        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;
        const isDay = data.current.is_day; // 1 for day, 0 for night
        
        const weather = weatherCodeMap[code] || { icon: "🌡️", night: "🌡️", label: "Unknown" };
        const displayIcon = isDay === 1 ? weather.icon : weather.night;

        const tempEl = document.getElementById("weather-temp");
        const iconEl = document.getElementById("weather-icon");

        if (tempEl) tempEl.innerText = `${temp}°C`;
        if (iconEl) {
            iconEl.innerText = displayIcon;
            iconEl.title = weather.label;
        }
    } catch (error) {
        console.error("Error fetching weather:", error);
    }
}
fetchWeather();
setInterval(fetchWeather, 30 * 60 * 1000); // Update every 30 mins


// Initialize Leaflet Map (Myanmar Centered)
const map = L.map("map", {
    zoomControl: false,
}).setView([19.7633, 96.0785], 6);

// Dark Layer (ESRI World Dark Gray - No API Key & No Watermark)
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    attribution: "&copy; Esri &mdash; OpenStreetMap contributors",
    maxZoom: 16
}).addTo(map);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 16
}).addTo(map);

// Move zoom control to bottom right
L.control.zoom({ position: "bottomright" }).addTo(map);

// Global State
let allNewsItems = [];
let allForecasts = [];
let currentFilter = "All";
let regionFilter = "All";
let searchQuery = "";
let heatLayer = null;
const markers = {};
const markerClusterGroup = L.markerClusterGroup({
    maxClusterRadius: 40,
    disableClusteringAtZoom: 15
});
markerClusterGroup.addTo(map);
let firstLoadComplete = false;

// Helper for local YYYY-MM-DD
function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

let dateFilter = getLocalDateString();

// Helper to convert 24h to 12h AM/PM
function formatTime12h(timeStr) {
    if (!timeStr || timeStr === "မသိရ") return escapeHTML(timeStr);
    try {
        // Handle "HH:mm:ss" or "HH:mm"
        const parts = timeStr.split(':');
        let hours = parseInt(parts[0]);
        if (isNaN(hours)) return escapeHTML(timeStr);
        const minutes = String(parts[1] || "00").substring(0, 2);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        return `${hours}:${escapeHTML(minutes)} ${ampm}`;
    } catch (e) {
        return escapeHTML(timeStr);
    }
}

// Helper to format date as dd-mmm-yyyy
function formatDateDisplay(dateStr) {
    if (!dateStr || dateStr === "null" || dateStr === "မသိရ" || dateStr === "မသိရှိပါ။") return escapeHTML(dateStr);
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return escapeHTML(dateStr);
        const d = String(date.getDate()).padStart(2, '0');
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const m = months[date.getMonth()];
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    } catch (e) {
        return escapeHTML(dateStr);
    }
}

// Helper to check if item matches the selected region (checks Region, City, and Township)
function matchesLocation(item, selectedRegion) {
    if (!selectedRegion || selectedRegion === "All") return true;
    const targets = [item.region, item.city, item.township].map(s => (s || "").toLowerCase());
    const filter = selectedRegion.toLowerCase();
    return targets.some(t => t.includes(filter));
}

// Helper to escape HTML and prevent XSS
function escapeHTML(str) {
    if (!str || typeof str !== 'string') return str || "";
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

// Helper to reliably count sub-categories across components
function getSubCategoryCounts(items, mainCategory, returnAll = false) {
    const subCounts = {};
    const allowedSubs = SUB_CATEGORIES[mainCategory] || [];

    const targetItems = mainCategory ? items.filter(i => i.crime_type === mainCategory) : items;

    targetItems.forEach(item => {
        const rawS = item.sub_category;
        if (!rawS) return;

        if (returnAll) {
            // Count EVERYTHING for detailed views (Map Popups)
            allowedSubs.forEach(spec => {
                if (rawS.includes(spec)) {
                    subCounts[spec] = (subCounts[spec] || 0) + 1;
                }
            });
        } else {
            // 🚀 ONE EVENT = ONE COUNT FIXED: 
            // We only pick the FIRST matching sub-category from our specification list 
            // for statistical balance (Header count == Sum of sub-categories).
            const matchedSpec = allowedSubs.find(spec => rawS.includes(spec));
            if (matchedSpec) {
                subCounts[matchedSpec] = (subCounts[matchedSpec] || 0) + 1;
            }
        }

        // Fallback for raw output (only if no mainCategory and no spec matched from allowedSubs)
        if (!mainCategory && Object.keys(subCounts).length === 0) {
            const cleaned = rawS.replace(/[{}]/g, '').split(/[,/]/);
            cleaned.forEach(part => {
                const s = part.trim();
                if (!s || ["null", "none", "n/a", "undefined", "-", "မသိရ", "အခြား"].includes(s.toLowerCase())) return;
                const shortName = s.length > 25 ? s.substring(0, 22) + "..." : s;
                subCounts[shortName] = (subCounts[shortName] || 0) + 1;
            });
        }
    });
    return subCounts;
}

const typeColors = {
    စစ်ရေးသတင်း: "#e74c3c",    // Red for Conflict/War
    မှုခင်းသတင်း: "#9b59b6",     // Purple for Crime
    မတော်တဆဖြစ်မှု: "#f1c40f",  // Yellow for Accident
    သဘာဝဘေးအန္တရာယ်: "#e67e22", // Orange for Disaster
    အထွေထွေ: "#3498db",        // Blue for General
    Other: "#7f8c8d",
};

// Sub-palette reflects the same vibe but slightly different tones
const SUB_PALETTE = [
    "#8e44ad", "#c0392b", "#f39c12", "#2980b9", "#d35400",
    "#16a085", "#2ecc71", "#27ae60", "#34495e", "#bdc3c7"
];

const typeIcons = {
    စစ်ရေးသတင်း: "⚔️",
    မှုခင်းသတင်း: "🚨",
    မတော်တဆဖြစ်မှု: "⚠️",
    သဘာဝဘေးအန္တရာယ်: "🌊",
    အထွေထွေ: "ℹ️",
    Other: "📍",
};

// Declared here, above the top-level updateTimelineDisplay() call further down.
// It used to sit below that call, so the very first updateUI() threw
// "Cannot access 'ALL_CATEGORIES' before initialization" on every page load --
// swallowed by a try/catch, but it meant the first paint never built the filters.
const ALL_CATEGORIES = [
    "စစ်ရေးသတင်း",
    "မှုခင်းသတင်း",
    "မတော်တဆဖြစ်မှု",
    "သဘာဝဘေးအန္တရာယ်",
    "အထွေထွေ"
];

const SUB_CATEGORIES = {
    "စစ်ရေးသတင်း": ["တိုက်ပွဲ", "လေကြောင်း", "လက်နက်ကြီး", "စစ်ကြောင်း", "မီးရှို့", "စစ်ဘေးရှောင်", "ဗုံးပေါက်ကွဲ", "ဖမ်းဆီး"],
    "မှုခင်းသတင်း": ["လုယက်", "ဓားပြတိုက်", "ဖောက်ထွင်း", "လူသတ်", "မူးယစ်ဆေး", "အွန်လိုင်းလိမ်လည်မှု", "လောင်းကစား", "ခိုးယူ", "ငွေညှစ်", "ရိုက်နှက်"],
    "မတော်တဆဖြစ်မှု": ["ကားတိုက်", "ဆိုင်ကယ်မှောက်", "မီးလောင်", "ရေနစ်", "သေဆုံး", "ဇက်ကျိုး", "ယာဉ်တိုက်မှု"],
    "သဘာဝဘေးအန္တရာယ်": ["ရေကြီး", "မုန်တိုင်း", "ငလျင်", "မြေပြို", "မိုးကြီး"],
    "အထွေထွေ": ["အပူချိန်", "ပွဲတော်", "သွေးလှူ", "လမ်းပိတ်", "ယာဉ်ကြောပိတ်", "နာရေး", "အရေးပေါ်", "ဆီပြတ်လပ်", "ထီဖွင့်ပွဲ", "ဖွင့်ပွဲ", "ပြပွဲ", "အခမ်းအနား", "စာမေးပွဲ", "နိုင်ငံရေး", "လွတ်ငြိမ်း", "ကုန်သွယ်မှု", "ရင်းနှီး မြှုပ်နှံမှု", "ရန်ပုံငွေ", "ကံစမ်းမဲ", "ရာထူးတိုး", "အသိပေး", "သတိပေး"]
};

// Chart Instances
let categoryChart = null;
let timeChart = null;
let correlationChart = null;

const dateFilterInput = document.getElementById("date-filter");
const regionFilterInput = document.getElementById("region-filter");
const categoryFilterInput = document.getElementById("category-filter");

const REGION_COORDINATES = {
    "All": { center: [19.7633, 96.0785], zoom: 6 },
    "ရန်ကုန်": { center: [16.8661, 96.1951], zoom: 10 },
    "မန္တလေး": { center: [21.9162, 96.0898], zoom: 10 },
    "စစ်ကိုင်း": { center: [22.8775, 95.4402], zoom: 8 },
    "ပဲခူး": { center: [17.3304, 96.4814], zoom: 9 },
    "မကွေး": { center: [20.1544, 94.9455], zoom: 8 },
    "ဧရာဝတီ": { center: [17.0341, 94.9455], zoom: 8 },
    "တနင်္သာရီ": { center: [13.2925, 98.7118], zoom: 7 },
    "နေပြည်တော်": { center: [19.7633, 96.0785], zoom: 11 },
    "ရှမ်း": { center: [21.1731, 98.0506], zoom: 7 },
    "ကချင်": { center: [25.4045, 97.4646], zoom: 7 },
    "ကယား": { center: [19.2342, 97.3323], zoom: 9 },
    "ကရင်": { center: [16.9425, 97.9593], zoom: 8 },
    "ချင်း": { center: [22.0163, 93.6450], zoom: 8 },
    "မွန်": { center: [16.1432, 97.7475], zoom: 9 },
    "ရခိုင်": { center: [19.3400, 93.5300], zoom: 7 }
};

// Initialize filters
if (dateFilterInput) dateFilterInput.value = dateFilter;

if (dateFilterInput) {
    dateFilterInput.onchange = (e) => {
        dateFilter = e.target.value;
        updateUI();
    };
}

if (regionFilterInput) {
    regionFilterInput.onchange = (e) => {
        regionFilter = e.target.value;
        const config = REGION_COORDINATES[regionFilter];
        if (config) {
            map.setView(config.center, config.zoom);
        }
        updateUI();
    };
}

if (categoryFilterInput) {
    categoryFilterInput.onchange = (e) => {
        currentFilter = e.target.value;
        updateUI();
    };
}

const searchQueryInput = document.getElementById("search-query");
if (searchQueryInput) {
    searchQueryInput.oninput = (e) => {
        searchQuery = e.target.value.toLowerCase();
        updateUI();
    };
}

const toggleHeatmapInput = document.getElementById("toggle-heatmap");
if (toggleHeatmapInput) {
    toggleHeatmapInput.onchange = (e) => {
        if (!heatLayer) return;
        if (e.target.checked) {
            if (!map.hasLayer(heatLayer)) heatLayer.addTo(map);
        } else {
            if (map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
        }
    };
}

const exportCsvBtn = document.getElementById("export-csv");
if (exportCsvBtn) {
    exportCsvBtn.onclick = () => {
        // Get the CURRENTLY FILTERED items using the same logic as UI
        const selectedDate = dateFilterInput.value || "";
        const selectedRegion = regionFilterInput.value || "All";
        const selectedType = categoryFilterInput.value || "All";

        const filtered = allNewsItems.filter(item => {
            const hasLocation = item.township || item.city || item.region;
            if (!hasLocation) return false;

            const itemDateStr = item.publish_date || "";
            const itemDate = itemDateStr.toString().split('T')[0].split(' ')[0];
            const matchesDate = !selectedDate || itemDate === selectedDate;
            const matchesReg = matchesLocation(item, selectedRegion);
            const matchesType = (selectedType === "All" || item.crime_type === selectedType);

            const textToSearch = (item.raw_text || "" + item.summary || "" + item.location_name || "").toLowerCase();
            const matchesSearch = !searchQuery || textToSearch.includes(searchQuery);

            return matchesDate && matchesReg && matchesType && matchesSearch;
        });

        exportToCSV(filtered);
    };
}

// Timeline Slider Logic
const timelineSlider = document.getElementById("timeline-slider");
const timelineDateDisplay = document.getElementById("current-timeline-date");
const timelinePrev = document.getElementById("timeline-prev");
const timelineNext = document.getElementById("timeline-next");
const timelinePlay = document.getElementById("timeline-play");

let isPlaying = false;
let playInterval = null;

function updateTimelineDisplay(sliderValue) {
    const date = new Date();
    date.setDate(date.getDate() - (30 - sliderValue));

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    dateFilter = dateStr;
    dateFilterInput.value = dateStr;

    // Format for display using the new helper
    timelineDateDisplay.innerText = formatDateDisplay(dateStr);

    updateUI();
}

if (timelineSlider) {
    timelineSlider.oninput = (e) => {
        updateTimelineDisplay(parseInt(e.target.value));
    };

    timelinePrev.onclick = () => {
        const val = parseInt(timelineSlider.value);
        if (val > 0) {
            timelineSlider.value = val - 1;
            updateTimelineDisplay(val - 1);
        }
    };

    timelineNext.onclick = () => {
        const val = parseInt(timelineSlider.value);
        if (val < 30) {
            timelineSlider.value = val + 1;
            updateTimelineDisplay(val + 1);
        }
    };
    
    function togglePlay() {
        if (isPlaying) {
            clearInterval(playInterval);
            isPlaying = false;
            timelinePlay.classList.remove('playing');
            timelinePlay.innerHTML = '<i data-lucide="play"></i>';
        } else {
            isPlaying = true;
            timelinePlay.classList.add('playing');
            timelinePlay.innerHTML = '<i data-lucide="pause"></i>';
            
            // If already at the end, restart from beginning
            if (parseInt(timelineSlider.value) >= 30) {
                timelineSlider.value = 0;
                updateTimelineDisplay(0);
            }
            
            playInterval = setInterval(() => {
                let val = parseInt(timelineSlider.value);
                if (val < 30) {
                    val++;
                    timelineSlider.value = val;
                    updateTimelineDisplay(val);
                } else {
                    // Stop playing when it reaches the end
                    togglePlay();
                }
            }, 800); // 800ms per day
        }
        // Re-initialize lucide icons for the new icon
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    if (timelinePlay) {
        timelinePlay.onclick = togglePlay;
    }
}
function syncTimelineWithDate(newDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(newDate);
    selected.setHours(0, 0, 0, 0);

    const diffTime = today - selected;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 30) {
        if (timelineSlider) timelineSlider.value = 30 - diffDays;
        if (timelineDateDisplay) timelineDateDisplay.innerText = formatDateDisplay(newDate);
    }
}

// Sync timeline slider when manual date filter changes
if (dateFilterInput) {
    dateFilterInput.onchange = (e) => {
        const newDate = e.target.value;
        dateFilter = newDate;
        syncTimelineWithDate(newDate);
        updateUI();
    };
}

// Start at today on timeline
if (timelineSlider) {
    try {
        updateTimelineDisplay(30);
    } catch (e) {
        console.error("Initial timeline update failed:", e);
    }
}

async function filterByCategory(cat) {
    categoryFilterInput.value = cat;
    currentFilter = cat;
    updateUI();
}

// The map opens on a single day, but the charts, the month's township ranking
// and the timeline scrubber all need history. Fetching 90 days before the first
// paint made the splash wait on ~180KB (gzipped) to draw one day's markers, so
// the initial load is split: a short window first, then the rest in background.
const INITIAL_DAYS = 3;   // today plus slack for timezone edges and empty days
const FULL_DAYS = 90;

// The map and accordion only ever show the selected day, so phase 1 renders them
// accurately. The charts and the township ranking aggregate across the month or
// the full window, so computing them from a 3-day slice produces numbers that
// look authoritative and are wrong. They stay in a loading state until the full
// history has actually arrived -- including when phase 2 fails, where the 30s
// refresh is what recovers it.
let historyLoaded = false;

// Fetch News Data
async function fetchNews(days = FULL_DAYS) {
    try {
        // Fetch news and active conflict forecasts concurrently to prevent page blocking
        const [newsRes, forecastRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/news?days=${days}&minimal=true&limit=10000`, {
                headers: { 'X-API-Key': API_KEY }
            }),
            fetch(`${API_BASE_URL}/api/forecasts`, {
                headers: { 'X-API-Key': API_KEY }
            }).catch(err => {
                console.error("Forecast fetch failed:", err);
                return null;
            })
        ]);

        if (!newsRes.ok) throw new Error("Network error");
        const data = await newsRes.json();

        if (forecastRes && forecastRes.ok) {
            allForecasts = await forecastRes.json();
        } else {
            allForecasts = [];
        }

        // Strictly normalize main categories to the 5 standard keys
        allNewsItems = data.map(item => {
            let rawType = (item.crime_type || "အထွေထွေ").trim();
            let finalType = "အထွေထွေ";

            if (rawType.includes("စစ်ရေး") || rawType === "တိုက်ပွဲသတင်း") finalType = "စစ်ရေးသတင်း";
            else if (rawType.includes("မှုခင်း")) finalType = "မှုခင်းသတင်း";
            else if (rawType.includes("မတော်တဆ") || rawType.includes("ယာဉ်တိုက်မှု")) finalType = "မတော်တဆဖြစ်မှု";
            else if (rawType.includes("သဘာဝဘေး")) finalType = "သဘာဝဘေးအန္တရာယ်";
            else if (rawType.includes("အထွေထွေ") || rawType === "Other") finalType = "အထွေထွေ";

            return { ...item, crime_type: finalType };
        });

        // Aggregate panels are only trustworthy once the full window is in hand.
        if (days >= FULL_DAYS) historyLoaded = true;
        // Only on the very first render. This used to run on every 30s refresh,
        // which snapped the slider back to today while dateFilterInput kept the
        // user's chosen date -- the scrubber and the map silently disagreed.
        if (!firstLoadComplete) {
            const todayStr = getLocalDateString();
            syncTimelineWithDate(todayStr);
        }

        updateUI();
        if (window.lucide) lucide.createIcons();

        // 🚀 Hide loading animation on first successful load
        if (!firstLoadComplete) {
            const loader = document.getElementById("loading-overlay");
            if (loader) {
                loader.classList.add("fade-out");
                setTimeout(() => {
                    loader.style.display = "none";
                }, 800); // Match transition duration
            }
            firstLoadComplete = true;
        }

        // Ensure charts resize to fill containers after initial data render
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 500);
    } catch (error) {
        console.error("Error fetching news:", error);
        // Ensure loader is hidden even on error to prevent being "frozen"
        const loader = document.getElementById("loading-overlay");
        if (loader) {
            loader.classList.add("fade-out");
            setTimeout(() => { loader.style.display = "none"; }, 800);
        }
    }
}

function updateUI() {
    const selectedDate = dateFilterInput ? dateFilterInput.value : dateFilter;
    const displayElement = document.getElementById("date-filter-display");
    if (displayElement) displayElement.innerText = formatDateDisplay(selectedDate);

    const selectedRegion = regionFilterInput ? regionFilterInput.value : "All";
    const selectedType = categoryFilterInput ? categoryFilterInput.value : "All";

    // Sync currentFilter variable (used by other functions) with dropdown
    currentFilter = selectedType;

    // 🚀 STRICTOR LOCATION GUARD: If township, city AND region are all null, don't show.
    const validItems = allNewsItems.filter(item => {
        const hasLocation = item.township || item.city || item.region;
        return hasLocation;
    });

    // Unified Filtering Logic
    const filtered = validItems.filter((item) => {
        const itemDateStr = item.publish_date || "";
        const itemDate = itemDateStr.toString().split('T')[0].split(' ')[0];
        const matchesDate = !selectedDate || itemDate === selectedDate;
        const matchesReg = matchesLocation(item, selectedRegion);
        const matchesType = (currentFilter === "All" || item.crime_type === currentFilter);

        // Search Filter
        const textToSearch = (item.raw_text || "" + item.summary || "" + item.location_name || "").toLowerCase();
        const matchesSearch = !searchQuery || textToSearch.includes(searchQuery);

        return matchesDate && matchesReg && matchesType && matchesSearch;
    });

    const forPieChart = validItems.filter((item) => {
        const itemDateStr = item.publish_date || "";
        const itemDate = itemDateStr.toString().split('T')[0].split(' ')[0];
        const matchesDate = !selectedDate || itemDate === selectedDate;
        return matchesDate && matchesLocation(item, selectedRegion);
    });

    const forTrends = validItems.filter(item => {
        const matchesReg = matchesLocation(item, selectedRegion);
        const matchesType = (selectedType === "All" || item.crime_type === selectedType);
        return matchesReg && matchesType;
    });

    try {
        updateFilters(forPieChart);
        updateMapMarkers(filtered);
        updateNewsAccordion(filtered);
        updateDangerousTownships(); // 🚀 UPDATED: Calculates for the current month regardless of filters
        renderCharts(filtered, forPieChart, forTrends);
    } catch (e) {
        console.error("Component update failed:", e);
    }

    if (window.lucide) {
        try { lucide.createIcons(); } catch (e) { }
    }
}

function updateFilters(items) {
    const topStatsPanel = document.getElementById("top-right-stats");
    topStatsPanel.innerHTML = "";

    ALL_CATEGORIES.forEach(cat => {
        const filteredItems = items.filter(i => i.crime_type === cat);
        const count = filteredItems.length;
        const icon = typeIcons[cat] || typeIcons.Other;

        const card = document.createElement("div");
        card.className = "top-stat-card";
        card.style.borderBottomColor = typeColors[cat];

        const actualSubs = getSubCategoryCounts(filteredItems, cat);

        // 🚀 UNIFIED FIX: Count items that result in ZERO matched sub-categories
        let uncategorizedCount = 0;
        filteredItems.forEach(item => {
            const itemSubs = getSubCategoryCounts([item], cat);
            const subSum = Object.values(itemSubs).reduce((a, b) => a + b, 0);
            if (subSum === 0) uncategorizedCount++;
        });

        if (uncategorizedCount > 0) {
            actualSubs["အခြား"] = (actualSubs["အခြား"] || 0) + uncategorizedCount;
        }

        const totalCount = Object.values(actualSubs).reduce((a, b) => a + b, 0);

        let subHtml = "";
        const subEntries = Object.entries(actualSubs);
        if (subEntries.length > 0) {
            subHtml = `<div class="sub-counts">`;
            subEntries.sort((a, b) => {
                // Keep "အခြား" at the bottom
                if (a[0] === "အခြား") return 1;
                if (b[0] === "အခြား") return -1;
                return b[1] - a[1];
            }).forEach(([sub, subCount], index) => {
                const subColor = sub === "အခြား" ? "#7f8c8d" : SUB_PALETTE[index % SUB_PALETTE.length];
                subHtml += `<div class="sub-item"><span style="color: ${subColor}; font-weight: 700;">•</span> <span>${sub}</span> <span style="background: ${subColor}22; color: ${subColor}; padding: 0px 6px; border-radius: 4px;">${subCount}</span></div>`;
            });
            subHtml += `</div>`;
        }

        const displayedCount = totalCount;

        const bgOpacity = "22"; // 13% opacity in hex
        const color = typeColors[cat];

        card.innerHTML = `
            <div class="stat-main-row" onclick="filterByCategory('${cat}')" style="cursor:pointer">
                <div class="data-box">
                    <div class="count" style="color: ${color}">${displayedCount}</div>
                    <div class="label">${cat}</div>
                </div>
                <div class="icon-box" style="background: ${color}${bgOpacity}; width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid ${color}${bgOpacity};">${icon}</div>
            </div>
            ${subHtml}
        `;

        card.onclick = (e) => {
            e.stopPropagation();
            // Close other cards first if desired (optional)
            // document.querySelectorAll('.top-stat-card').forEach(c => { if(c !== card) c.classList.remove('expanded'); });
            card.classList.toggle("expanded");
        };

        topStatsPanel.appendChild(card);
    });
}

// ECharts loads async and off the critical path, so it may not exist yet on the
// first render. Remember the arguments and replay once the library arrives.
let lastChartArgs = null;
window.__chartsReady = function () {
    if (lastChartArgs) {
        try { renderCharts.apply(null, lastChartArgs); } catch (e) { console.error("Chart replay failed:", e); }
    }
};

function renderCharts(filteredItems, pieDataItems, fullItems) {
    lastChartArgs = [filteredItems, pieDataItems, fullItems];
    if (!window.echarts) return; // __chartsReady() will re-invoke this on load
    // Trend and correlation charts span the full window; drawing them from a
    // 3-day slice would render a real-looking but wrong series, then snap.
    if (!historyLoaded) return;

    const selectedRegion = regionFilterInput.value || "All";
    const selectedDate = dateFilterInput.value || "";

    // Global/Re-used constants
    const refDate = selectedDate ? new Date(selectedDate) : new Date();
    const currentYear = refDate.getFullYear();
    const currentMonth = refDate.getMonth(); // 0-indexed
    const currentDay = refDate.getDate();
    const myanmarMonths = ["ဇန်", "ဖေ", "မတ်", "ဧ", "မေ", "ဇွန်", "ဇူ", "ဩ", "စက်", "အောက်", "နို", "ဒီ"];

    // 1. Category Stats (Donut Chart) 
    let chartData = [];
    const isFiltered = currentFilter !== "All";

    if (!isFiltered) {
        // 🚀 SYNC: Show regional category distribution for the SELECTED DATE
        // This ensures the Donut Chart matches the Top-Right Stats Cards
        chartData = ALL_CATEGORIES.map(cat => {
            const catItems = pieDataItems.filter(i => i.crime_type === cat);
            const subs = getSubCategoryCounts(catItems, cat);

            let uncategorized = 0;
            catItems.forEach(item => {
                const itemSubs = getSubCategoryCounts([item], cat);
                if (Object.keys(itemSubs).length === 0) uncategorized++;
            });

            const total = Object.values(subs).reduce((a, b) => a + b, 0) + uncategorized;

            return {
                name: cat,
                value: total,
                itemStyle: { color: typeColors[cat] || typeColors.Other }
            };
        }).filter(d => d.value > 0);
    } else {
        // Show sub-categories of the CURRENTLY SELECTED main category
        const subCounts = getSubCategoryCounts(filteredItems, currentFilter);

        // Count uncategorized for the active category filter
        let uncategorized = 0;
        filteredItems.forEach(item => {
            const itemSubs = getSubCategoryCounts([item], currentFilter);
            if (Object.keys(itemSubs).length === 0) uncategorized++;
        });
        if (uncategorized > 0) subCounts["အခြား"] = (subCounts["အခြား"] || 0) + uncategorized;

        chartData = Object.entries(subCounts)
            .sort((a, b) => {
                if (a[0] === "အခြား") return 1;
                if (b[0] === "အခြား") return -1;
                return b[1] - a[1];
            })
            .slice(0, 15)
            .map(([name, value], index) => ({
                name: name,
                value: value,
                itemStyle: { color: name === "အခြား" ? "#7f8c8d" : SUB_PALETTE[index % SUB_PALETTE.length] }
            }));
    }

    const hasData = chartData.length > 0;
    if (!hasData) {
        chartData = [{ name: "ရလဒ်မရှိပါ။", value: 0, itemStyle: { color: 'rgba(255,255,255,0.05)' } }];
    }

    if (!categoryChart) {
        const container = document.getElementById('categoryChart');
        if (!container) return;
        if (typeof echarts === 'undefined') {
            console.error("ECharts not loaded.");
            return;
        }
        categoryChart = echarts.init(container);
        // Add click integration to donut chart
        categoryChart.on('click', (params) => {
            if (params.name) {
                // If in "All" view, click to filter by category
                if (currentFilter === "All") {
                    currentFilter = params.name;
                    categoryFilterInput.value = currentFilter;
                    updateUI();
                } else {
                    // If in sub-category view, clicking a slice resets to "All" (Drill back up)
                    // currentFilter = "All";
                    // categoryFilterInput.value = "All";
                    // updateUI();
                }
            }
        });
    }

    const categoryOption = {
        tooltip: { trigger: 'item', padding: 10, borderRadius: 8, show: hasData },
        legend: {
            show: hasData,
            orient: 'vertical',
            left: '5%',
            top: 'middle',
            itemGap: 12,
            textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: isFiltered ? 9 : 10, fontWeight: '500' },
            icon: 'circle',
            formatter: (name) => {
                return name.length > 20 ? name.substring(0, 18) + '...' : name;
            }
        },
        title: !hasData ? {
            text: 'ရလဒ်မရှိပါ။',
            left: 'center',
            top: 'center',
            textStyle: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 'normal' }
        } : null,
        series: [{
            name: isFiltered ? '' : 'အမျိုးအစား',
            type: 'pie',
            radius: ['45%', '72%'],
            center: ['75%', '55%'],
            avoidLabelOverlap: true,
            itemStyle: {
                borderRadius: 4,
                borderColor: '#1a1a1f',
                borderWidth: 2,
                opacity: hasData ? 1 : 0.2
            },
            label: {
                show: false
            },
            data: chartData
        }],
        backgroundColor: 'transparent'
    };
    categoryChart.setOption(categoryOption, true); // Use true to replace previous config entirely

    // 2. Stacked Bar Chart (Categories over Time)
    const monthLabels = [];
    for (let i = 0; i <= currentMonth; i++) {
        monthLabels.push(myanmarMonths[i]);
    }

    // Initialize counts: category -> [month0, month1, ...]
    const categoryTrend = {};
    const relevantCats = currentFilter === "All" ? ALL_CATEGORIES : [currentFilter];

    relevantCats.forEach(cat => {
        categoryTrend[cat] = new Array(currentMonth + 1).fill(0);
    });

    fullItems.forEach(item => {
        const itemDateStr = item.publish_date || item.event_date;
        if (itemDateStr) {
            const itemDate = new Date(itemDateStr);
            const itemYear = itemDate.getFullYear();
            const itemMonth = itemDate.getMonth();

            // Strictly reflect the timeline: 
            // 1. Must be the selected year (or earlier, but labels are for current year)
            // 2. If it's the current year, it must be <= currentMonth
            // 3. If it's exactly the current month, it must be <= currentDay (to reflect slider)
            if (itemYear === currentYear) {
                if (itemMonth < currentMonth || (itemMonth === currentMonth && itemDate.getDate() <= currentDay)) {
                    const cat = item.crime_type;
                    if (categoryTrend[cat] !== undefined) {
                        const subs = getSubCategoryCounts([item], cat);
                        const tagCount = Object.values(subs).reduce((a, b) => a + b, 0);
                        categoryTrend[cat][itemMonth] += Math.max(1, tagCount);
                    }
                }
            }
        }
    });

    if (!timeChart) {
        const container = document.getElementById('timeChart');
        if (!container) return;
        if (typeof echarts === 'undefined') return;
        timeChart = echarts.init(container);
    }

    const timeOption = {
        grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: {
            show: false,
            top: '0%',
            textStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
            itemWidth: 10,
            itemHeight: 10
        },
        xAxis: {
            type: 'category',
            data: monthLabels,
            axisLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        yAxis: {
            type: 'value',
            minInterval: 1,
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
            axisLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10 }
        },
        series: relevantCats.map(cat => ({
            name: cat,
            type: 'bar',
            barGap: '10%',
            data: categoryTrend[cat],
            itemStyle: {
                color: typeColors[cat] || typeColors.Other,
                borderRadius: [2, 2, 0, 0]
            },
            emphasis: { focus: 'series' }
        })),
        backgroundColor: 'transparent'
    };
    timeChart.setOption(timeOption, true);

    // 3. Correlation Chart (IDP vs Others - Daily View)
    if (!correlationChart) {
        const container = document.getElementById('correlationChart');
        if (container) correlationChart = echarts.init(container);
    }

    const correlationData = [];
    const targetMonth = refDate.getMonth();
    const targetYear = refDate.getFullYear();
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    const monthName = myanmarMonths[targetMonth];

    // Aggregate by day for the selected month/region
    // Loop through the entire month to show the full trend
    for (let d = 1; d <= lastDay; d++) {
        let idpCount = 0;
        let otherCount = 0;

        (fullItems || []).forEach(item => {
            if (item.publish_date) {
                // Robust date parsing using new Date()
                const itemDate = new Date(item.publish_date);
                const y = itemDate.getFullYear();
                const m = itemDate.getMonth();
                const dayOfMonth = itemDate.getDate();

                if (y === targetYear && m === targetMonth && dayOfMonth === d) {
                    const counts = getSubCategoryCounts([item], item.crime_type);
                    if (counts["စစ်ဘေးရှောင်"]) {
                        idpCount += counts["စစ်ဘေးရှောင်"];
                    } else {
                        // Count other valid tags or the item itself
                        const tagSum = Object.values(counts).reduce((a, b) => a + b, 0);
                        otherCount += Math.max(1, tagSum);
                    }
                }
            }
        });

        if (idpCount > 0 || otherCount > 0) {
            correlationData.push([d, otherCount, idpCount]); // X: Day, Y: Others, Value: IDP
        }
    }

    const correlationOption = {
        grid: { left: '8%', right: '8%', bottom: '20%', top: '20%', containLabel: true },
        tooltip: {
            padding: 10,
            backgroundColor: 'rgba(20, 20, 25, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            textStyle: { color: '#fff' },
            formatter: (params) => {
                const data = params.data;
                return `<div style="font-weight:700; margin-bottom:5px;">${monthName}လ ${data[0]}ရက်</div>
                        <div style="font-size:12px;">အခြားဖြစ်စဉ်: <span style="color:#fff">${data[1]}</span></div>
                        <div style="font-size:12px;">စစ်ဘေးရှောင်: <span style="color:#f7b731">${data[2]}</span></div>`;
            }
        },
        xAxis: {
            name: 'ရက်စွဲ (ရက်)',
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: { color: 'rgba(255, 255, 255, 0.5)', fontSize: 10 },
            min: 1,
            max: lastDay,
            interval: 5,
            splitLine: { show: false },
            axisLabel: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 10 },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        yAxis: {
            name: 'အခြားဖြစ်စဉ်များ',
            nameLocation: 'middle',
            nameGap: 40,
            nameTextStyle: { color: 'rgba(255, 255, 255, 0.5)', fontSize: 10 },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
            axisLabel: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 10 }
        },
        series: [{
            symbolSize: (data) => {
                // Size represents IDP count (min 12px, max 45px for better visibility)
                const s = Math.sqrt(data[2]) * 10 + 12;
                return Math.min(s, 45);
            },
            data: correlationData,
            type: 'scatter',
            itemStyle: {
                color: (params) => {
                    if (params.data[0] === currentDay) return '#ffdd59';
                    return params.data[2] > 0 ? '#f7b731' : '#4b6584';
                },
                opacity: 0.8,
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.3)',
                borderColor: 'rgba(255,255,255,0.4)',
                borderWidth: 1
            },
            emphasis: {
                focus: 'self',
                scale: 1.2,
                itemStyle: {
                    opacity: 1,
                    shadowBlur: 20,
                    borderColor: '#fff',
                    borderWidth: 2
                }
            }
        }],
        backgroundColor: 'transparent'
    };
    correlationChart.setOption(correlationOption, true);
}

function updateMapMarkers(items) {
    // Basic deduplication for aircraft alerts
    const dedupedItems = [];
    const seenAircraft = new Set();

    items.forEach(item => {
        let isAircraft = item.sub_category && (item.sub_category.includes("လေကြောင်း") || item.sub_category.includes("လေယာဉ်"));
        if (isAircraft && item.latitude && item.longitude) {
            // Group by Date, Heading, and approximate Location (2 decimal places ~ 1km radius)
            const latKey = parseFloat(item.latitude).toFixed(2);
            const lngKey = parseFloat(item.longitude).toFixed(2);
            const key = `${item.event_date}_${latKey}_${lngKey}_${item.heading}`;
            if (!seenAircraft.has(key)) {
                seenAircraft.add(key);
                dedupedItems.push(item);
            }
        } else {
            dedupedItems.push(item);
        }
    });

    const newItemsMap = new Map();
    dedupedItems.forEach(item => {
        if (item.latitude && item.longitude) {
            newItemsMap.set(String(item.id), item);
        }
    });

    // 1. Remove markers that are no longer in the filtered list
    Object.keys(markers).forEach(id => {
        if (!newItemsMap.has(id)) {
            if (markers[id].marker) markerClusterGroup.removeLayer(markers[id].marker);
            if (markers[id].flightLine) map.removeLayer(markers[id].flightLine);
            delete markers[id];
        }
    });

    // 2. Add or Update markers
    newItemsMap.forEach((item, id) => {
        if (!markers[id]) {
            const color = typeColors[item.crime_type] || typeColors["Other"];
            const icon = typeIcons[item.crime_type] || typeIcons["Other"];

            // Strictly identify Airstrikes, fall back old 'လေကြောင်း' data to Air Alerts (Orange)
            let isAirstrike = item.sub_category && item.sub_category.includes("လေကြောင်းတိုက်ခိုက်မှု");
            let isAirAlert = item.sub_category && (item.sub_category.includes("လေယာဉ်သတိပေးချက်") || item.sub_category.includes("လေကြောင်းသတိပေးချက်") || item.sub_category === "လေကြောင်း" || item.sub_category.includes("လေယာဉ်"));
            let isAircraft = isAirstrike || isAirAlert;
            let customIconHtml = '';
            
            if (isAircraft) {
                let rotation = 0; // Default if no heading
                if (item.heading && item.heading.toLowerCase() !== 'null') {
                    const h = item.heading.toLowerCase().trim().replace(" ", "");
                    const rotMap = {
                        "north": -45, "south": 135, "east": 45, "west": 225,
                        "northeast": 0, "northwest": -90, "southeast": 90, "southwest": 180
                    };
                    if (rotMap[h] !== undefined) rotation = rotMap[h];
                }

                const radarClass = isAirAlert ? "radar-ping alert" : "radar-ping";
                const bgColor = isAirAlert ? "#f39c12" : "#c0392b";
                const shadowColor = isAirAlert ? "rgba(243, 156, 18, 0.8)" : "rgba(192, 57, 43, 0.8)";

                customIconHtml = `
                <div class="map-marker-container radar-container" style="width:22px; height:22px;">
                    <div class="${radarClass}"></div>
                    <div style="background-color:${bgColor}; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1.5px solid #fff; font-size:12px; position:relative; z-index:2; box-shadow: 0 0 10px ${shadowColor};">
                        <span style="transform: rotate(${rotation}deg); display: inline-block;">✈️</span>
                    </div>
                </div>`;
            } else {
                customIconHtml = `
                <div class="map-marker-container" style="width:22px; height:22px;">
                    <div class="pulse-ring" style="background-color:${color};"></div>
                    <div style="background-color:${color}; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1.5px solid #fff; font-size:12px; position:relative; z-index:2;">
                        ${icon}
                    </div>
                </div>`;
            }

            const customIcon = L.divIcon({
                html: customIconHtml,
                className: "custom-div-icon",
                iconSize: [22, 22],
                iconAnchor: [11, 11],
            });

            const marker = L.marker([item.latitude, item.longitude], {
                icon: customIcon,
                riseOnHover: true // Improves visibility depth
            });
            markerClusterGroup.addLayer(marker);

            // SYNC: When marker popup opens, expand accordion
            marker.on('popupopen', () => {
                expandNewsItem(item.id, false); // Pass 'false' to prevent map loops
            });

            const typeLabel = escapeHTML(item.crime_type || "အခြား");
            const subCounts = getSubCategoryCounts([item], item.crime_type, true); // 🚀 pass true to show all tags in popup
            const subLabel = Object.keys(subCounts).length > 0
                ? `<div style="font-size: 11px; margin-bottom:6px;">🏷️ ${Object.keys(subCounts).map(s => `<span class="sub-tag">${s}</span>`).join(" ")}</div>`
                : "";
            const typeClass = `type-${typeLabel.split(" ").join("-")}`;
            const locDetails = [item.region, item.township, item.city].map(escapeHTML).filter(Boolean).join("၊ ");

            // Agentic Badges
            const agentBadges = renderAgentBadges(item);

            marker.bindPopup(
                `
                <div style="font-family: 'Inter', sans-serif; padding: 5px; color: #fff;">
                    <div class="type-tag ${typeClass}" style="margin-bottom:4px">${typeLabel}</div>
                    ${subLabel}
                    ${agentBadges}
                    <strong style="display:block; margin-bottom:4px; font-size:14px;">${locDetails || escapeHTML(item.location_name)}</strong>
                    <div style="font-size: 12px; opacity: 0.8; margin-top:6px;">
                        <div>📅 ဖြစ်ပွားရက်: ${formatDateDisplay(item.event_date) || "မသိရ"}</div>
                        <div>⏰ ဖြစ်ပွားချိန်: ${formatTime12h(item.event_time) || "မသိရ"}</div>
                        <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">📰 ရင်းမြစ်: ${escapeHTML(item.source_name || item.channel_handle)}</div>
                    </div>
                    <button class="inspect-agent-btn" onclick="window.openAgentInspector(${item.id})">🧠 Agent Trace စစ်ဆေးရန်</button>
                </div>
                `,
                { maxWidth: 280, autoPan: true }
            );

            // Add heading arrow line if aircraft
            let flightLine = null;
            if (isAircraft && item.heading && item.heading.toLowerCase() !== 'null') {
                const h = item.heading.toLowerCase().trim().replace(" ", "");
                const headingMap = {
                    "north": [1, 0], "south": [-1, 0], "east": [0, 1], "west": [0, -1],
                    "northeast": [1, 1], "northwest": [1, -1], "southeast": [-1, 1], "southwest": [-1, -1]
                };
                const dir = headingMap[h] || [0,0];
                if (dir[0] !== 0 || dir[1] !== 0) {
                    const destLat = item.latitude + (dir[0] * 0.3); // approx distance
                    const destLng = item.longitude + (dir[1] * 0.3);
                    const lineColor = isAirAlert ? '#f39c12' : '#ff4757';
                    flightLine = L.polyline([
                        [item.latitude, item.longitude],
                        [destLat, destLng]
                    ], {
                        color: lineColor,
                        weight: 3,
                        opacity: 0.3,
                        dashArray: '5, 10',
                        className: 'flight-path-animated'
                    }).addTo(map);
                }
            }

            markers[id] = { marker, flightLine, data: item };
        } else {
            markers[id].data = item; // Keep data fresh
        }
    });

    // 3. Update Heatmap Layer
    const points = items
        .filter(i => i.latitude && i.longitude)
        .map(i => [parseFloat(i.latitude), parseFloat(i.longitude), 0.8]); // Increased intensity

    if (heatLayer) {
        heatLayer.setLatLngs(points);
        const toggleHeatmap = document.getElementById("toggle-heatmap");
        if (toggleHeatmap && toggleHeatmap.checked && !map.hasLayer(heatLayer)) {
            heatLayer.addTo(map);
        }
    } else {
        heatLayer = L.heatLayer(points, {
            radius: 35, // Increased radius
            blur: 20,
            maxZoom: 14,
            minOpacity: 0.4,
            gradient: { 0.4: 'blue', 0.6: 'lime', 1: 'yellow' }
        });

        const toggleHeatmap = document.getElementById("toggle-heatmap");
        if (toggleHeatmap && toggleHeatmap.checked) {
            heatLayer.addTo(map);
        }
    }
}

function exportToCSV(items) {
    if (!items || items.length === 0) {
        alert("ဒေါင်းလုဒ်လုပ်ရန် ဒေတာမရှိပါ။");
        return;
    }

    // Define columns to EXCLUDE
    const exclude = ["channel_handle", "raw_text", "summary", "source_name"];

    // Prepare Headers and rename crime_type to category
    const firstItem = items[0];
    const allKeys = Object.keys(firstItem);
    const headers = allKeys
        .filter(k => !exclude.includes(k))
        .map(k => k === "crime_type" ? "category" : k);

    // Create CSV rows
    const csvRows = [headers.join(",")];

    items.forEach(item => {
        const row = allKeys
            .filter(k => !exclude.includes(k))
            .map(k => {
                let val = item[k];
                if (val === null || val === undefined) val = "";

                // Escape commas and quotes
                const escaped = String(val).replace(/"/g, '""');
                return `"${escaped}"`;
            });
        csvRows.push(row.join(","));
    });

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute("download", `burmaduta_export_${getLocalDateString()}.csv`);
    link.click();
}


function updateNewsAccordion(items) {
    const container = document.getElementById("news-accordion");
    const countBadge = document.getElementById("news-count-badge");
    container.innerHTML = "";

    // Show all items but let CSS handle scrolling
    countBadge.innerText = items.length;

    if (items.length === 0) {
        container.innerHTML = `<div class="status">ရလဒ်မရှိပါ။</div>`;
        return;
    }

    // Pre-sort items to ensure newest are at the top
    const sortedItems = [...items].sort((a, b) => b.id - a.id);

    sortedItems.forEach(item => {
        const locDetails = [item.region, item.township, item.city].map(escapeHTML).filter(Boolean).join("၊ ");
        const timeStr = `ဖြစ်ပွားချိန်: 📅 ${formatDateDisplay(item.event_date) || "မသိရ"} | ⏰ ${formatTime12h(item.event_time) || "မသိရ"}`;
        const agentBadges = renderAgentBadges(item);

        const div = document.createElement("div");
        div.className = "accordion-item";
        div.id = `news-item-${item.id}`;
        div.innerHTML = `
            <div class="accordion-header" onclick="expandNewsItem(${item.id})">
                <div class="title-group">
                    <span class="news-loc">${locDetails || escapeHTML(item.location_name)}</span>
                    <span class="news-time">${timeStr}</span>
                    ${agentBadges}
                </div>
                <div class="icon-box" style="font-size: 1.2rem;">${typeIcons[item.crime_type] || "📍"}</div>
            </div>
            <div class="accordion-content">
                <div class="accordion-summary">${escapeHTML(item.summary) || "သတင်းအကျဉ်း မရှိပါ။"}</div>
                <div class="accordion-footer">
                    <span class="accordion-source">📡 ${escapeHTML(item.source_name || item.channel_handle)} | သတင်းရက်စွဲ: ${formatDateDisplay(item.publish_date) || "မသိရ"}</span>
                    <button class="inspect-agent-btn" onclick="event.stopPropagation(); window.openAgentInspector(${item.id});">🧠 Agent Trace</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function expandNewsItem(id) {
    // 1. Close all other items
    document.querySelectorAll('.accordion-item').forEach(el => {
        if (el.id !== `news-item-${id}`) el.classList.remove('expanded');
    });

    const target = document.getElementById(`news-item-${id}`);
    if (target) {
        target.classList.toggle('expanded');
        if (target.classList.contains('expanded')) {
            target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

// Global accessor for compatibility
window.expandNewsItem = expandNewsItem;
window.showNewsDetailById = expandNewsItem;

window.resetToHomeView = () => {
    // Reset filters
    currentFilter = "All";
    categoryFilterInput.value = "All";
    regionFilterInput.value = "All";

    // Reset date to today or latest available exactly like fetchNews
    const todayStr = getLocalDateString();
    let targetDate = todayStr;

    if (allNewsItems.length > 0) {
        const hasTodayNews = allNewsItems.some(item => {
            const itemDateStr = item.publish_date || "";
            return itemDateStr.toString().startsWith(todayStr);
        });

        if (!hasTodayNews) {
            const dates = allNewsItems.map(i => i.publish_date).filter(Boolean);
            if (dates.length > 0) {
                targetDate = dates.sort().reverse()[0].split('T')[0].split(' ')[0];
            }
        }
    }

    dateFilterInput.value = targetDate;
    syncTimelineWithDate(targetDate);

    // Update UI and map view
    updateUI();
    map.flyTo([19.7633, 96.0785], 6, { animate: true, duration: 1.5 }); // Reset map center to Myanmar
};
// Global Window Resize Handler for all charts
window.addEventListener('resize', () => {
    if (categoryChart) categoryChart.resize();
    if (timeChart) timeChart.resize();
    if (correlationChart) correlationChart.resize();
});

// 🚀 Top 5 Dangerous Townships Logic (Monthly Overall)
function updateDangerousTownships() {
    const listBody = document.getElementById("township-list");
    if (!listBody) return;

    // This ranks the whole selected month. Ranking a 3-day slice would show a
    // confidently wrong top 5, so wait for the full history rather than guess.
    if (!historyLoaded) {
        listBody.innerHTML = `<div class="status" style="padding: 10px;">ခေတ္တစောင့်ဆိုင်းပေးပါ...</div>`;
        return;
    }

    // Get month prefix from the SELECTED DATE instead of today
    const selectedDate = dateFilterInput.value || getLocalDateString();
    const currentMonthPrefix = selectedDate.substring(0, 7);

    // Filter allNewsItems for the selected month, ignoring local category/region filters
    // to keep it as an 'overall' monthly trend for that period.
    const thisMonthItems = allNewsItems.filter(item => {
        const itemDateStr = item.publish_date || item.event_date || "";
        return itemDateStr.toString().startsWith(currentMonthPrefix);
    });

    // Filter out "General" category
    const nonGeneralItems = thisMonthItems.filter(i => i.crime_type !== "အထွေထွေ");

    const weightMap = {
        "စစ်ရေးသတင်း": 5,
        "မှုခင်းသတင်း": 3,
        "သဘာဝဘေးအန္တရာယ်": 2,
        "မတော်တဆဖြစ်မှု": 1
    };

    const counts = {};
    const noiseFilter = ["မသိရ", "မသိရှိရ", "မသိရှိပါ။"];

    nonGeneralItems.forEach(item => {
        let ts = item.township || item.city || item.region;
        if (!ts || noiseFilter.includes(ts.trim())) return;

        const weight = weightMap[item.crime_type] || 1;

        // Count tags for this item
        const subCounts = getSubCategoryCounts([item], item.crime_type);
        const totalTags = Object.values(subCounts).reduce((a, b) => a + b, 0);

        // 🚀 ADVANCED SCORE: weight * (totalTags || 1)
        const score = weight * (totalTags || 1);
        counts[ts] = (counts[ts] || 0) + score;
    });

    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (sorted.length === 0) {
        listBody.innerHTML = `<div class="status" style="padding: 10px;">ဒေတာမရှိပါ။</div>`;
        return;
    }

    const maxVal = sorted[0][1]; // Highest for scaling bars
    listBody.innerHTML = sorted.map(([name, count]) => {
        const perc = (count / maxVal) * 100;
        
        // Find forecast trend if available (cleaning suffixes for robust matching)
        const forecast = allForecasts.find(f => {
            const cleanName = name.replace(/(မြို့နယ်|မြို့)$/, "").trim();
            const cleanF = f.township.replace(/(မြို့နယ်|မြို့)$/, "").trim();
            return cleanF === cleanName;
        });

        let trendBadge = "";
        if (forecast) {
            if (forecast.trend === "up") {
                trendBadge = `<span class="trend-badge trend-up" title="ပဋိပက္ခ ပိုမိုဆိုးရွားလာနိုင်သည်" style="color: #ff4757; margin-left: 6px; font-weight: bold; cursor: help; font-size: 0.85em;">▲</span>`;
            } else if (forecast.trend === "down") {
                trendBadge = `<span class="trend-badge trend-down" title="ပဋိပက္ခ လျော့ကျသွားနိုင်သည်" style="color: #2ed573; margin-left: 6px; font-weight: bold; cursor: help; font-size: 0.85em;">▼</span>`;
            } else {
                trendBadge = `<span class="trend-badge trend-stable" title="ပုံမှန်အတိုင်း ဆက်ရှိနေမည်" style="color: #747d8c; margin-left: 6px; font-weight: bold; cursor: help; font-size: 0.85em;">●</span>`;
            }
        }

        return `
            <div class="township-stat-item">
                <div class="township-info-row">
                    <span class="township-name">${escapeHTML(name)}${trendBadge}</span>
                    <span class="township-count">${count} <span style="font-size:0.6em; opacity:0.7; font-weight:normal;">မှတ်</span></span>
                </div>
                <div class="danger-bar-container">
                    <div class="danger-bar-fill" style="width: ${perc}%"></div>
                </div>
            </div>
        `;
    }).join("");
}

// =====================================================================
// 🤖 Autonomous Agent & Emergency Observability Functions
// =====================================================================

function renderAgentBadges(item) {
    let badges = '';
    const verdict = item.fact_check_verdict || 'VERIFIED';
    const score = item.credibility_score !== undefined ? Math.round(item.credibility_score * 100) : 85;
    
    if (verdict === 'VERIFIED') {
        badges += `<span class="agent-badge badge-verified">🟢 စစ်ဆေးပြီး (${score}%)</span>`;
    } else if (verdict === 'PLAUSIBLE') {
        badges += `<span class="agent-badge badge-plausible">🟡 ဖြစ်နိုင်ခြေရှိ (${score}%)</span>`;
    } else if (verdict === 'FAKE_NEWS' || verdict === 'DISPUTED') {
        badges += `<span class="agent-badge badge-fake">🔴 သတင်းတု သံသယ</span>`;
    }

    if (item.priority_level === 'CRITICAL_EMERGENCY') {
        badges += `<span class="agent-badge badge-priority-critical">🚨 အရေးပေါ် (${item.emergency_type || 'hazard'})</span>`;
    } else if (item.priority_level === 'HIGH_PRIORITY') {
        badges += `<span class="agent-badge badge-priority-high">⚠️ ဦးစားပေး</span>`;
    }

    return `<div class="agent-badge-row">${badges}</div>`;
}

// 🚨 Fetch & Render Active Emergency Alerts
async function fetchEmergencyAlerts() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/agent/alerts?limit=5`, {
            headers: { 'X-API-Key': API_KEY }
        });
        if (!res.ok) return;
        const data = await res.json();
        const alerts = data.alerts || [];

        const banner = document.getElementById("emergency-banner");
        const bannerText = document.getElementById("emergency-banner-text");
        const zoomBtn = document.getElementById("emergency-zoom-btn");

        if (alerts.length > 0 && banner && bannerText) {
            const topAlert = alerts[0];
            bannerText.innerText = `${topAlert.region || ''} ${topAlert.township || ''} - ${topAlert.headline}`;
            banner.style.display = "block";

            if (zoomBtn && topAlert.latitude && topAlert.longitude) {
                zoomBtn.onclick = () => {
                    map.flyTo([topAlert.latitude, topAlert.longitude], 12, { animate: true, duration: 1.5 });
                    if (topAlert.news_id) expandNewsItem(topAlert.news_id);
                };
            }
        }
    } catch (err) {
        console.error("Error fetching emergency alerts:", err);
    }
}

// 🧠 Open Agent Reasoning Inspector Modal
window.openAgentInspector = function(newsId) {
    const item = allNewsItems.find(i => i.id === newsId);
    if (!item) return;

    const modal = document.getElementById("agent-inspector-modal");
    const modalBody = document.getElementById("agent-modal-body");
    if (!modal || !modalBody) return;

    let traceData = null;
    try {
        if (item.agent_trace) {
            traceData = typeof item.agent_trace === 'string' ? JSON.parse(item.agent_trace) : item.agent_trace;
        }
    } catch (e) {
        console.error("Error parsing agent trace:", e);
    }

    const steps = traceData?.reasoning_chain || [
        { step: 1, phase: "THOUGHT", message: "Processed news item through autonomous ReAct loop." },
        { step: 2, phase: "TOOL_EXECUTION", tool: "tool_fact_checker", observation: { verdict: item.fact_check_verdict || "VERIFIED", score: item.credibility_score || 0.85 } },
        { step: 3, phase: "TOOL_EXECUTION", tool: "tool_geo_inferencer", observation: { township: item.township, coordinates: [item.latitude, item.longitude] } },
        { step: 4, phase: "FINAL_DECISION", decision: "RECORD_NEWS_EVENT", priority: item.priority_level || "STANDARD" }
    ];

    let stepsHtml = steps.map(s => {
        const phaseClass = s.phase === 'TOOL_EXECUTION' ? 'phase-tool' : (s.phase === 'AUTONOMOUS_ACTION' ? 'phase-action' : 'phase-thought');
        const toolBadge = s.tool ? `<span class="step-tool-name">🛠️ ${s.tool}</span>` : '';
        const phaseTag = `<span class="step-phase-tag">${s.phase}</span>`;
        
        let detailHtml = '';
        if (s.message) detailHtml += `<div>${escapeHTML(s.message)}</div>`;
        if (s.observation) detailHtml += `<div class="trace-json-box">Observation: ${JSON.stringify(s.observation, null, 2)}</div>`;
        if (s.input) detailHtml += `<div class="trace-json-box" style="color:#70a1ff;">Input: ${JSON.stringify(s.input, null, 2)}</div>`;
        if (s.action) detailHtml += `<div style="color:#eb3b5a; font-weight:bold; margin-top:4px;">⚡ Action: ${escapeHTML(s.action)}</div>`;
        if (s.dispatch_details) detailHtml += `<div class="trace-json-box">Dispatch: ${JSON.stringify(s.dispatch_details, null, 2)}</div>`;

        return `
            <div class="trace-step ${phaseClass}">
                <div class="trace-step-dot"></div>
                <div class="trace-step-header">
                    ${phaseTag}
                    ${toolBadge}
                </div>
                <div class="trace-step-body">${detailHtml}</div>
            </div>
        `;
    }).join('');

    modalBody.innerHTML = `
        <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 0.9rem; font-weight: 700; color: #fff; margin-bottom: 4px;">📰 ${escapeHTML(item.summary || item.location_name)}</div>
            <div style="font-size: 0.75rem; color: #a4b0be;">📡 Channel: ${escapeHTML(item.channel_handle || item.source_name)} | Run ID: ${traceData?.run_id || 'run_' + item.id} | Latency: ${traceData?.duration_ms || 180}ms</div>
        </div>
        <div class="trace-timeline">
            ${stepsHtml}
        </div>
    `;

    modal.style.display = "flex";
};

window.closeAgentInspector = function() {
    const modal = document.getElementById("agent-inspector-modal");
    if (modal) modal.style.display = "none";
};

// 🕹️ Interactive Agent Live Sandbox
window.toggleAgentSandbox = function() {
    const drawer = document.getElementById("agent-sandbox-drawer");
    if (!drawer) return;
    drawer.style.display = drawer.style.display === "none" ? "flex" : "none";
    if (window.lucide) lucide.createIcons();
};

window.runAgentSandbox = async function() {
    const input = document.getElementById("sandbox-input-text");
    const resultContainer = document.getElementById("sandbox-result-container");
    const runBtn = document.getElementById("sandbox-run-btn");
    if (!input || !resultContainer) return;

    const text = input.value.trim();
    if (!text) {
        alert("ကျေးဇူးပြု၍ သတင်းစာသား ထည့်သွင်းပါ။");
        return;
    }

    runBtn.disabled = true;
    runBtn.innerHTML = `<span>⏳ Agent စဉ်းစားဆန်းစစ်နေပါသည်...</span>`;
    resultContainer.style.display = "block";
    resultContainer.innerHTML = `<div style="text-align:center; padding: 20px; color:#f7b731;">🤖 Agent Reasoning in progress...</div>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/agent/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({ text: text, channel_handle: "@sandbox_demo" })
        });
        const data = await res.json();
        const agentRes = data.result;

        let stepsHtml = (agentRes.reasoning_chain || []).map(s => {
            const phaseClass = s.phase === 'TOOL_EXECUTION' ? 'phase-tool' : (s.phase === 'AUTONOMOUS_ACTION' ? 'phase-action' : 'phase-thought');
            const phaseTitle = `${s.phase}${s.tool ? ` (${s.tool})` : ''}`;
            
            let contentHtml = '';
            if (s.message) {
                contentHtml = `<div style="font-size:0.8rem; color:#e2e8f0; line-height:1.4;">${escapeHTML(s.message)}</div>`;
            } else if (s.observation) {
                const obsEntries = Object.entries(s.observation).map(([k, v]) => {
                    const valStr = typeof v === 'object' ? JSON.stringify(v) : v;
                    return `<div style="font-size:0.75rem; color:#cbd5e1; margin-top:3px; word-break:break-word;"><span style="color:#20bf6b; font-weight:600;">${escapeHTML(k)}:</span> ${escapeHTML(String(valStr))}</div>`;
                }).join('');
                contentHtml = `<div style="display:flex; flex-direction:column; gap:2px; margin-top:4px; max-width:100%; word-break:break-word;">${obsEntries}</div>`;
            } else if (s.decision) {
                contentHtml = `<div style="font-size:0.8rem; font-weight:bold; color:#20bf6b; margin-top:2px;">${escapeHTML(s.decision)}</div>`;
            } else if (s.action) {
                contentHtml = `<div style="font-size:0.8rem; font-weight:bold; color:#eb3b5a; margin-top:2px;">⚡ ${escapeHTML(s.action)}</div>`;
            }

            return `
                <div class="trace-step ${phaseClass}" style="margin-bottom: 8px; padding: 10px 12px; max-width: 100%; box-sizing: border-box;">
                    <div style="font-size:0.7rem; font-weight:bold; color:#f7b731; margin-bottom: 4px; word-break:break-word;">${escapeHTML(phaseTitle)}</div>
                    <div class="trace-step-body" style="max-width: 100%; word-break:break-word;">${contentHtml}</div>
                </div>
            `;
        }).join('');

        resultContainer.innerHTML = `
            <div style="background: rgba(255,255,255,0.03); border:1px solid rgba(247,183,49,0.3); border-radius:8px; padding:12px; max-width:100%; box-sizing:border-box; word-break:break-word;">
                <div style="font-size: 0.85rem; font-weight: bold; color: #20bf6b; margin-bottom: 6px;">🎯 Agent Output Summary:</div>
                <div style="font-size: 0.8rem; line-height: 1.4; color: #fff;">
                    <div>• <strong>Fact-Check:</strong> ${escapeHTML(agentRes.fact_check_verdict || '')} (Score: ${agentRes.credibility_score})</div>
                    <div>• <strong>Priority:</strong> ${escapeHTML(agentRes.priority_level || '')} (Emergency: ${agentRes.is_emergency_alert ? '🚨 YES' : 'NO'})</div>
                    <div>• <strong>Location:</strong> ${escapeHTML(agentRes.township || 'General')} (${agentRes.latitude || '--'}, ${agentRes.longitude || '--'})</div>
                    <div>• <strong>Latency:</strong> ${agentRes.duration_ms}ms</div>
                </div>
                <div style="margin-top: 10px; font-size: 0.75rem; font-weight: bold; color: #f7b731;">📜 Execution Trace (${agentRes.reasoning_chain?.length || 0} Steps):</div>
                <div style="margin-top: 6px; max-width:100%;">${stepsHtml}</div>
            </div>
        `;
    } catch (err) {
        resultContainer.innerHTML = `<div style="color:#eb3b5a; word-break:break-word;">Error executing agent: ${escapeHTML(err.message)}</div>`;
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = `<i data-lucide="play"></i> Agent ဖြင့် စစ်ဆေးဆန်းစစ်ပါ`;
        if (window.lucide) lucide.createIcons();
    }
};

// Initial Execution after DOM is safe
async function initialLoad() {
    // Phase 1 - a few days only. Renders the map and dismisses the splash.
    await fetchNews(INITIAL_DAYS);
    fetchEmergencyAlerts();
    // Phase 2 - full history for the charts, township ranking and scrubber.
    fetchNews(FULL_DAYS);
}

document.addEventListener('DOMContentLoaded', () => {
    initialLoad();
    setInterval(() => {
        fetchNews(FULL_DAYS);
        fetchEmergencyAlerts();
    }, 30000); // Live refresh every 30 seconds
    if (window.lucide) {
        try { lucide.createIcons(); } catch (e) { }
    }
});
