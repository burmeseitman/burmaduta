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
    if (!timeStr || timeStr === "မသိရ") return timeStr;
    try {
        // Handle "HH:mm:ss" or "HH:mm"
        const parts = timeStr.split(':');
        let hours = parseInt(parts[0]);
        const minutes = parts[1] || "00";
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        return `${hours}:${minutes} ${ampm}`;
    } catch (e) {
        return timeStr;
    }
}

const typeColors = {
    စစ်ရေးသတင်း: "#8e44ad",
    မှုခင်းသတင်း: "#eb3b5a",
    မတော်တဆဖြစ်မှု: "#fa8231",
    သဘာဝဘေးအန္တရာယ်: "#2980b9",
    အထွေထွေ: "#4b6584",
    Other: "#4b6584",
};

const typeIcons = {
    စစ်ရေးသတင်း: "⚔️",
    မှုခင်းသတင်း: "🚨",
    မတော်တဆဖြစ်မှု: "⚠️",
    သဘာဝဘေးအန္တရာယ်: "🌊",
    အထွေထွေ: "ℹ️",
    Other: "📍",
};

const SUB_CATEGORIES = {
    "စစ်ရေးသတင်း": ["တိုက်ပွဲဖြစ်ပွားမှု", "လက်နက်ကြီး/လေကြောင်းရန်", "စစ်ဘေးရှောင်သတင်း", "စစ်ကြောင်း", "ဖမ်းဆီး", "ဗုံးပေါက်ကွဲ", "တိုက်ပွဲ"],
    "မှုခင်းသတင်း": ["လုယက်", "ဓားပြတိုက်", "ဖောက်ထွင်း", "လူသတ်", "မူးယစ်ဆေး", "ခိုးယူ", "ဓားပြ", "လုယက်မှု", "လူသတ်မှု", "မူးယစ်"],
    "မတော်တဆဖြစ်မှု": ["ကားတိုက်", "ဆိုင်ကယ်မှောက်", "မီးလောင်", "ရေနစ်", "ယာဉ်တိုက်မှု", "မီးလောင်မှု"],
    "သဘာဝဘေးအန္တရာယ်": ["ရေကြီး", "မုန်တိုင်း", "ငလျင်", "မြေပြို", "မိုးကြီး"],
    "အထွေထွေ": ["အပူချိန်", "ပွဲတော်", "သွေးလှူ", "လမ်းပိတ်", "ယာဉ်ကြောပိတ်", "နာရေး", "အရေးပေါ်", "ဆီပြတ်လပ်", "ထီဖွင့်ပွဲ", "သတင်း", "အသိပေး", "သတိပေး"]
};

// Chart Instances
let categoryChart = null;
let timeChart = null;

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

async function fetchNews() {
    try {
        const response = await fetch("/api/news");
        const data = await response.json();
        // Normalize categories and handle NULLs
        allNewsItems = data.map(item => ({
            ...item,
            crime_type: (!item.crime_type || item.crime_type === "Other" || item.crime_type.includes("အထွေထွေ")) ? "အထွေထွေ" :
                (item.crime_type === "တိုက်ပွဲသတင်း") ? "စစ်ရေးသတင်း" : item.crime_type
        }));
        updateUI();
    } catch (error) {
        console.error("Error fetching news:", error);
    }
}

function updateUI() {
    const selectedDate = dateFilterInput.value || "";
    const selectedRegion = regionFilterInput.value || "All";
    const selectedType = categoryFilterInput.value || "All";

    // Sync currentFilter variable (used by other functions) with dropdown
    currentFilter = selectedType;

    // 🚀 COMPLETENESS GUARD: If no city, no region AND no sub category, don't show.
    const validItems = allNewsItems.filter(item => {
        const hasLocation = item.city || item.region;
        const sub = item.sub_category;
        const hasSub = sub && !["null", "none", "n/a", "undefined", "-", "မသိရ", "အခြား", ""].includes(sub.toLowerCase());

        // Return true only if it has at least Location OR a valid Sub-category
        // (Per user: "if no city, no region and no sub category dont count and dont show")
        return hasLocation || hasSub;
    });

    // Filter for Map, Time Chart, and News Feed
    const filtered = validItems.filter((item) => {
        // Use publish_date for searching/filtering as requested
        const itemDateStr = item.publish_date || "";
        const itemDate = itemDateStr.toString().split('T')[0].split(' ')[0];

        const matchesDate = !selectedDate || itemDate === selectedDate;
        const matchesRegion = selectedRegion === "All" || (item.region && item.region.includes(selectedRegion));
        const matchesType = (currentFilter === "All" || item.crime_type === currentFilter);

        return matchesDate && matchesRegion && matchesType;
    });

    // Filter specifically for Pie Chart
    const forPieChart = validItems.filter((item) => {
        const itemDateStr = item.publish_date || "";
        const itemDate = itemDateStr.toString().split('T')[0].split(' ')[0];
        const matchesDate = !selectedDate || itemDate === selectedDate;
        const matchesRegion = selectedRegion === "All" || (item.region && item.region.includes(selectedRegion));
        return matchesDate && matchesRegion;
    });

    // Update Top Stats based on current region/date but spanning categories
    updateFilters(forPieChart);
    updateMapMarkers(filtered);
    updateNewsAccordion(filtered);
    renderCharts(filtered, forPieChart); // Pass both to the chart renderer
    if (window.lucide) lucide.createIcons();
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

        // 🚀 FILTERED: Only get sub-categories that match the specification
        const actualSubs = {};
        const allowedSubs = SUB_CATEGORIES[cat] || [];

        filteredItems.forEach(i => {
            const rawS = i.sub_category;
            if (!rawS) return;

            // Handle potential variations like "{A,B}", "A/B", or Burmese punctuation
            const cleaned = rawS.replace(/[{}]/g, '').split(/[,/၊]/);

            cleaned.forEach(part => {
                const s = part.trim();
                if (!s || ["null", "none", "n/a", "undefined", "-", "မသိရ"].includes(s.toLowerCase())) return;

                // Flexible matching with specification
                const matchedSpec = allowedSubs.find(spec => s.includes(spec) || spec.includes(s));
                const finalLabel = matchedSpec || (s.length > 20 ? s.substring(0, 18) + '...' : s);
                actualSubs[finalLabel] = (actualSubs[finalLabel] || 0) + 1;
            });
        });

        let subHtml = "";
        const subEntries = Object.entries(actualSubs);
        if (subEntries.length > 0) {
            subHtml = `<div class="sub-counts">`;
            subEntries.sort((a, b) => b[1] - a[1]).forEach(([sub, subCount]) => {
                subHtml += `<div class="sub-item"><span>${sub}:</span> <span>${subCount}</span></div>`;
            });
            subHtml += `</div>`;
        }

        card.innerHTML = `
            <div class="stat-main-row">
                <div class="data-box">
                    <div class="count">${count}</div>
                    <div class="label">${cat}</div>
                </div>
                <div class="icon-box">${icon}</div>
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

function renderCharts(filteredItems, pieDataItems) {
    // 1. Category Stats (Donut Chart) 
    let chartData = [];
    const isFiltered = currentFilter !== "All";

    if (!isFiltered) {
        // Show main categories (overall distribution)
        const categoryCounts = {};
        ALL_CATEGORIES.forEach(cat => categoryCounts[cat] = 0);
        (pieDataItems || filteredItems).forEach(item => {
            const cat = item.crime_type;
            if (categoryCounts.hasOwnProperty(cat)) {
                categoryCounts[cat]++;
            }
        });
        chartData = ALL_CATEGORIES.map(cat => ({
            name: cat,
            value: categoryCounts[cat],
            itemStyle: { color: typeColors[cat] || typeColors.Other }
        }));
    } else {
        // Show sub-categories of the CURRENTLY SELECTED main category
        const subCounts = {};
        const allowedSubs = SUB_CATEGORIES[currentFilter] || [];

        filteredItems.forEach(item => {
            const rawS = item.sub_category;
            if (!rawS) return;

            // Handle potential variations like "{A,B}" or "A/B"
            const cleaned = rawS.replace(/[{}]/g, '').split(/[,/၊]/);

            cleaned.forEach(part => {
                const s = part.trim();
                // Skip if empty, null string, or generic placeholders
                if (!s || ["null", "none", "n/a", "undefined", "-", "မသိရ", "အခြား"].includes(s.toLowerCase())) return;

                // Find match in specification
                const matchedSpec = allowedSubs.find(spec => s.includes(spec) || spec.includes(s));

                if (matchedSpec) {
                    subCounts[matchedSpec] = (subCounts[matchedSpec] || 0) + 1;
                } else {
                    // FALLBACK: Use the literal name if no keyword matches, but only if it's not too long
                    const shortName = s.length > 15 ? s.substring(0, 12) + "..." : s;
                    subCounts[shortName] = (subCounts[shortName] || 0) + 1;
                }
            });
        });

        // Convert to ECharts format
        chartData = Object.entries(subCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10) // Limit to top 10 sub-categories for better visualization
            .map(([name, value]) => ({
                name: name,
                value: value
            }));

        // If no data for this category meets the specification
        if (chartData.length === 0) {
            chartData = [{ name: "မရှိပါ", value: 0 }];
        }
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
        tooltip: { trigger: 'item', padding: 10, borderRadius: 8 },
        legend: {
            orient: 'vertical',
            left: '5%',
            top: 'middle',
            itemGap: 12,
            textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: isFiltered ? 9 : 10, fontWeight: '500' },
            icon: 'circle',
            formatter: (name) => {
                // Shorten long sub-category names in legend if needed
                return name.length > 20 ? name.substring(0, 18) + '...' : name;
            }
        },
        series: [{
            name: isFiltered ? '' : 'အမျိုးအစား',
            type: 'pie',
            radius: ['45%', '72%'], // Donut style
            center: ['75%', '55%'], // Position for visibility
            avoidLabelOverlap: true,
            itemStyle: {
                borderRadius: 4,
                borderColor: '#1a1a1f',
                borderWidth: 2
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
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-indexed
    const myanmarMonths = ["ဇန်", "ဖေ", "မတ်", "ဧ", "မေ", "ဇွန်", "ဇူ", "ဩ", "စက်", "အောက်", "နို", "ဒီ"];

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

    filteredItems.forEach(item => {
        const itemDateStr = item.publish_date; // Use publish_date for the time trend chart as well
        if (itemDateStr) {
            const date = new Date(itemDateStr);
            if (date.getFullYear() === currentYear) {
                const m = date.getMonth();
                if (m <= currentMonth) {
                    const cat = item.crime_type;
                    if (categoryTrend[cat]) {
                        categoryTrend[cat][m]++;
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

    // Handle Window Resize
    window.addEventListener('resize', () => {
        if (categoryChart) categoryChart.resize();
        if (timeChart) timeChart.resize();
    });
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

            const typeLabel = item.crime_type || "အခြား";
            const subLabel = item.sub_category ? `<div style="font-size: 11px; color: ${color}; margin-top: -4px; margin-bottom: 8px; font-weight: 700; opacity: 0.9;"># ${item.sub_category}</div>` : "";
            const typeClass = `type-${typeLabel.split(" ").join("-")}`;
            const locDetails = [item.region, item.township, item.city].filter(Boolean).join("၊ ");

            marker.bindPopup(
                `
                <div style="font-family: 'Inter', sans-serif; padding: 5px; color: #fff;">
                    <div class="type-tag ${typeClass}" style="margin-bottom:8px">${typeLabel}</div>
                    ${subLabel}
                    <strong style="display:block; margin-bottom:4px; font-size:14px;">${locDetails || item.location_name}</strong>
                    <div style="font-size: 12px; opacity: 0.8; margin-top:8px;">
                        <div>📅 ဖြစ်ပွားရက်: ${item.event_date || "မသိရ"}</div>
                        <div>⏰ ဖြစ်ပွားချိန်: ${formatTime12h(item.event_time) || "မသိရ"}</div>
                        <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">📰 ရင်းမြစ်: ${item.source_name || item.channel_handle}</div>
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
    countBadge.innerText = items.length;

    if (items.length === 0) {
        container.innerHTML = `<div class="status">ရလဒ်မရှိပါ။</div>`;
        return;
    }

    items.forEach(item => {
        const locDetails = [item.region, item.township, item.city].filter(Boolean).join("၊ ");
        const timeStr = `📅 ${item.event_date || "မသိရှိပါ။"} | ⏰ ${formatTime12h(item.event_time) || "မသိရှိပါ။"}`;

        const div = document.createElement("div");
        div.className = "accordion-item";
        div.id = `news-item-${item.id}`;
        div.innerHTML = `
            <div class="accordion-header" onclick="expandNewsItem(${item.id})">
                <div class="title-group">
                    <span class="news-loc">${locDetails || item.location_name}</span>
                    <span class="news-time">${timeStr}</span>
                </div>
                <div class="icon-box" style="font-size: 1.2rem;">${typeIcons[item.crime_type] || "📍"}</div>
            </div>
            <div class="accordion-content">
                <div class="accordion-summary">${item.summary || "သတင်းအကျဉ်း မရှိပါ။"}</div>
                <div class="accordion-footer">
                    <span class="accordion-source">📡 ${item.source_name || item.channel_handle}</span>
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
// Initial Fetch
fetchNews();
setInterval(fetchNews, 30000); // Live refresh every 30 seconds
if (window.lucide) lucide.createIcons();
