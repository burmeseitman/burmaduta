const API_BASE_URL = "https://api.burmaduta.com";


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
let regionFilter = "All";
const markers = {};

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
function getSubCategoryCounts(items, mainCategory) {
    const subCounts = {};
    const allowedSubs = SUB_CATEGORIES[mainCategory] || [];

    // If mainCategory is given, filter items first
    const targetItems = mainCategory ? items.filter(i => i.crime_type === mainCategory) : items;

    targetItems.forEach(item => {
        const rawS = item.sub_category;
        if (!rawS) return;

        // Unified extraction logic (regex for brackets, split by Burmese/English punctuation)
        const cleaned = rawS.replace(/[{}]/g, '').split(/[,/၊]/);

        cleaned.forEach(part => {
            const s = part.trim();
            // Skip placeholders
            if (!s || ["null", "none", "n/a", "undefined", "-", "မသိရ", "အခြား", "သတင်း", "သတင်းအချက်အလက်"].includes(s.toLowerCase())) return;

            // Strict match with specification first
            const matchedSpec = allowedSubs.find(spec => s.includes(spec) || spec.includes(s));

            if (matchedSpec) {
                subCounts[matchedSpec] = (subCounts[matchedSpec] || 0) + 1;
            } else if (!mainCategory) {
                // If we're not filtering by a specific category, we might still want the raw name
                const shortName = s.length > 25 ? s.substring(0, 22) + "..." : s;
                subCounts[shortName] = (subCounts[shortName] || 0) + 1;
            }
        });
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

const SUB_CATEGORIES = {
    "စစ်ရေးသတင်း": ["တိုက်ပွဲ", "လေကြောင်း", "လက်နက်ကြီး", "စစ်ကြောင်း", "မီးရှို့", "စစ်ဘေးရှောင်", "ဗုံးပေါက်ကွဲ", "ဖမ်းဆီး"],
    "မှုခင်းသတင်း": ["လုယက်", "ဓားပြတိုက်", "ဖောက်ထွင်း", "လူသတ်", "မူးယစ်ဆေး", "အွန်လိုင်းလိမ်လည်မှု", "လောင်းကစား", "ခိုးယူ"],
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
dateFilterInput.value = dateFilter;

dateFilterInput.onchange = (e) => {
    dateFilter = e.target.value;
    updateUI();
};

regionFilterInput.onchange = (e) => {
    regionFilter = e.target.value;

    // Interactive Linking: Zoom to the selected region
    const config = REGION_COORDINATES[regionFilter];
    if (config) {
        map.setView(config.center, config.zoom);
    }

    updateUI();
};

categoryFilterInput.onchange = (e) => {
    currentFilter = e.target.value;
    updateUI();
};

// Timeline Slider Logic
const timelineSlider = document.getElementById("timeline-slider");
const timelineDateDisplay = document.getElementById("current-timeline-date");
const timelinePrev = document.getElementById("timeline-prev");
const timelineNext = document.getElementById("timeline-next");

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
dateFilterInput.onchange = (e) => {
    const newDate = e.target.value;
    dateFilter = newDate;
    syncTimelineWithDate(newDate);
    updateUI();
};

// Start at today on timeline
if (timelineSlider) updateTimelineDisplay(30);

async function filterByCategory(cat) {
    categoryFilterInput.value = cat;
    currentFilter = cat;
    updateUI();
}

async function fetchNews() {
    try {
        const endpoint = `${API_BASE_URL}/api/news`;
        const response = await fetch(endpoint);
        const data = await response.json();

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
        // If first fetch and no news for today, default to the latest date available
        const todayStr = getLocalDateString();
        const hasTodayNews = allNewsItems.some(item => {
            const itemDateStr = item.publish_date || "";
            return itemDateStr.toString().startsWith(todayStr);
        });

        if (allNewsItems.length > 0 && !hasTodayNews && dateFilter === todayStr) {
            const dates = allNewsItems.map(i => i.publish_date).filter(Boolean);
            if (dates.length > 0) {
                const maxDate = dates.sort().reverse()[0].split('T')[0].split(' ')[0];
                dateFilter = maxDate;
                dateFilterInput.value = maxDate;
                syncTimelineWithDate(maxDate);
            }
        }

        updateUI();
        if (window.lucide) lucide.createIcons();
    } catch (error) {
        console.error("Error fetching news:", error);
    }
}

function updateUI() {
    const selectedDate = dateFilterInput.value || "";
    const displayElement = document.getElementById("date-filter-display");
    if (displayElement) displayElement.innerText = formatDateDisplay(selectedDate);

    const selectedRegion = regionFilterInput.value || "All";
    const selectedType = categoryFilterInput.value || "All";

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
        return matchesDate && matchesReg && matchesType;
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

const ALL_CATEGORIES = [
    "စစ်ရေးသတင်း",
    "မှုခင်းသတင်း",
    "မတော်တဆဖြစ်မှု",
    "သဘာဝဘေးအန္တရာယ်",
    "အထွေထွေ"
];

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

        // 🚀 UNIFIED: Calculate total count as sum of (tags or 1) per item
        const catItems = items.filter(i => i.crime_type === cat);
        let totalCount = 0;
        catItems.forEach(item => {
            const subs = getSubCategoryCounts([item], cat);
            const subSum = Object.values(subs).reduce((a, b) => a + b, 0);
            totalCount += Math.max(1, subSum);
        });

        const actualSubs = getSubCategoryCounts(catItems, cat);
        let subHtml = "";
        const subEntries = Object.entries(actualSubs);
        if (subEntries.length > 0) {
            subHtml = `<div class="sub-counts">`;
            subEntries.sort((a, b) => b[1] - a[1]).forEach(([sub, subCount], index) => {
                const subColor = SUB_PALETTE[index % SUB_PALETTE.length];
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

function renderCharts(filteredItems, pieDataItems, fullItems) {
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
            let totalCount = 0;
            catItems.forEach(item => {
                const subs = getSubCategoryCounts([item], cat);
                const subSum = Object.values(subs).reduce((a, b) => a + b, 0);
                totalCount += Math.max(1, subSum);
            });
            
            return {
                name: cat,
                value: totalCount,
                itemStyle: { color: typeColors[cat] || typeColors.Other }
            };
        }).filter(d => d.value > 0); 
    } else {
        // Show sub-categories of the CURRENTLY SELECTED main category
        const subCounts = getSubCategoryCounts(filteredItems, currentFilter);

        chartData = Object.entries(subCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15) 
            .map(([name, value], index) => ({
                name: name,
                value: value,
                itemStyle: { color: SUB_PALETTE[index % SUB_PALETTE.length] }
            }));
    }

    const hasData = chartData.length > 0;
    if (!hasData) {
        chartData = [{ name: "ရလဒ်မရှိပါ။", value: 0, itemStyle: { color: 'rgba(255,255,255,0.05)' } }];
    }

    if (!categoryChart) {
        categoryChart = echarts.init(document.getElementById('categoryChart'));
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
        timeChart = echarts.init(document.getElementById('timeChart'));
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
        correlationChart = echarts.init(document.getElementById('correlationChart'));
    }

    const correlationData = [];
    // If no date is selected, use today to pick target month/year
    const targetMonth = refDate.getMonth();
    const targetYear = refDate.getFullYear();
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    const monthName = myanmarMonths[targetMonth];

    // Aggregate by day for the selected month/region
    for (let d = 1; d <= currentDay; d++) {
        let idpCount = 0;
        let otherCount = 0;

        (fullItems || []).forEach(item => {
            if (item.publish_date) {
                const [y, m, dayOfMonth] = item.publish_date.split('-').map(Number);
                if (y === targetYear && (m - 1) === targetMonth && dayOfMonth === d) {
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
                // Size represents IDP count (min 8px, max 40px)
                const s = Math.sqrt(data[2]) * 8 + 8;
                return Math.min(s, 40);
            },
            data: correlationData,
            type: 'scatter',
            itemStyle: {
                color: (params) => {
                    // Highlight selected day
                    if (params.data[0] === currentDay) return '#ffdd59'; 
                    return params.data[2] > 0 ? '#f7b731' : '#4b6584';
                },
                opacity: (params) => (params.data[0] === currentDay ? 1 : 0.7),
                shadowBlur: 15,
                shadowColor: 'rgba(0, 0, 0, 0.3)',
                borderColor: (params) => (params.data[0] === currentDay ? '#fff' : 'rgba(255,255,255,0.3)'),
                borderWidth: (params) => (params.data[0] === currentDay ? 2 : 1)
            },
            emphasis: {
                itemStyle: {
                    color: '#fff',
                    borderColor: '#f7b731',
                    borderWidth: 2,
                    opacity: 1
                }
            }
        }],
        backgroundColor: 'transparent'
    };
    correlationChart.setOption(correlationOption, true);
}

function updateMapMarkers(items) {
    const newItemsMap = new Map();
    items.forEach(item => {
        if (item.latitude && item.longitude) {
            newItemsMap.set(String(item.id), item);
        }
    });

    // 1. Remove markers that are no longer in the filtered list
    Object.keys(markers).forEach(id => {
        if (!newItemsMap.has(id)) {
            if (markers[id].marker) map.removeLayer(markers[id].marker);
            delete markers[id];
        }
    });

    // 2. Add or Update markers
    newItemsMap.forEach((item, id) => {
        if (!markers[id]) {
            const color = typeColors[item.crime_type] || typeColors["Other"];
            const icon = typeIcons[item.crime_type] || typeIcons["Other"];

            const customIcon = L.divIcon({
                html: `
                <div class="map-marker-container" style="width:22px; height:22px;">
                    <div class="pulse-ring" style="background-color:${color};"></div>
                    <div style="background-color:${color}; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1.5px solid #fff; font-size:12px; position:relative; z-index:2;">
                        ${icon}
                    </div>
                </div>`,
                className: "custom-div-icon",
                iconSize: [22, 22],
                iconAnchor: [11, 11],
            });

            const marker = L.marker([item.latitude, item.longitude], {
                icon: customIcon,
                riseOnHover: true // Improves visibility depth
            }).addTo(map);

            // SYNC: When marker popup opens, expand accordion
            marker.on('popupopen', () => {
                expandNewsItem(item.id, false); // Pass 'false' to prevent map loops
            });

            const typeLabel = escapeHTML(item.crime_type || "အခြား");
            const safeSub = escapeHTML(item.sub_category);
            const subLabel = safeSub ? `<div style="font-size: 11px; color: ${color}; margin-top: -4px; margin-bottom: 8px; font-weight: 700; opacity: 0.9;"># ${safeSub}</div>` : "";
            const typeClass = `type-${typeLabel.split(" ").join("-")}`;
            const locDetails = [item.region, item.township, item.city].map(escapeHTML).filter(Boolean).join("၊ ");

            marker.bindPopup(
                `
                <div style="font-family: 'Inter', sans-serif; padding: 5px; color: #fff;">
                    <div class="type-tag ${typeClass}" style="margin-bottom:8px">${typeLabel}</div>
                    ${subLabel}
                    <strong style="display:block; margin-bottom:4px; font-size:14px;">${locDetails || escapeHTML(item.location_name)}</strong>
                    <div style="font-size: 12px; opacity: 0.8; margin-top:8px;">
                        <div>📅 ဖြစ်ပွားရက်: ${formatDateDisplay(item.event_date) || "မသိရ"}</div>
                        <div>⏰ ဖြစ်ပွားချိန်: ${formatTime12h(item.event_time) || "မသိရ"}</div>
                        <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">📰 ရင်းမြစ်: ${escapeHTML(item.source_name || item.channel_handle)}</div>
                    </div>
                </div>
                `,
                { maxWidth: 250, autoPan: true }
            );

            markers[id] = { marker, data: item };
        } else {
            markers[id].data = item; // Keep data fresh
        }
    });
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

        const div = document.createElement("div");
        div.className = "accordion-item";
        div.id = `news-item-${item.id}`;
        div.innerHTML = `
            <div class="accordion-header" onclick="expandNewsItem(${item.id})">
                <div class="title-group">
                    <span class="news-loc">${locDetails || escapeHTML(item.location_name)}</span>
                    <span class="news-time">${timeStr}</span>
                </div>
                <div class="icon-box" style="font-size: 1.2rem;">${typeIcons[item.crime_type] || "📍"}</div>
            </div>
            <div class="accordion-content">
                <div class="accordion-summary">${escapeHTML(item.summary) || "သတင်းအကျဉ်း မရှိပါ။"}</div>
                <div class="accordion-footer">
                    <span class="accordion-source">📡 ${escapeHTML(item.source_name || item.channel_handle)} | သတင်းရက်စွဲ: ${formatDateDisplay(item.publish_date) || "မသိရ"}</span>
                    <span style="opacity: 0.5;">ID: #${item.id}</span>
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

    const counts = {};
    nonGeneralItems.forEach(item => {
        const ts = item.township || item.city || item.region || "မသိရှိရ";
        if (ts === "မသိရှိရ") return;

        // Count tags for this item
        const subCounts = getSubCategoryCounts([item], item.crime_type);
        const totalTags = Object.values(subCounts).reduce((a, b) => a + b, 0);

        // Add to aggregate (minimum 1 if item exists)
        counts[ts] = (counts[ts] || 0) + (totalTags || 1);
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
        return `
            <div class="township-stat-item">
                <div class="township-info-row">
                    <span class="township-name">${escapeHTML(name)}</span>
                    <span class="township-count">${count}</span>
                </div>
                <div class="danger-bar-container">
                    <div class="danger-bar-fill" style="width: ${perc}%"></div>
                </div>
            </div>
        `;
    }).join("");
}

// Initial Fetch
fetchNews();
setInterval(fetchNews, 30000); // Live refresh every 30 seconds
if (window.lucide) lucide.createIcons();
