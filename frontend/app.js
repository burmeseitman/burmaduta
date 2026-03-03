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
    "စစ်ရေးသတင်း": ["တိုက်ပွဲဖြစ်ပွားမှု", "လက်နက်ကြီး/လေကြောင်းရန်", "စစ်ဘေးရှောင်သတင်း"],
    "မှုခင်းသတင်း": ["လုယက်", "ဓားပြတိုက်", "ဖောက်ထွင်း", "လူသတ်", "မူးယစ်ဆေး"],
    "မတော်တဆဖြစ်မှု": ["ကားတိုက်", "ဆိုင်ကယ်မှောက်", "မီးလောင်", "ရေနစ်"],
    "သဘာဝဘေးအန္တရာယ်": ["ရေကြီး", "မုန်တိုင်း", "ငလျင်", "မြေပြို"]
};

// Chart Instances
let categoryChart = null;
let timeChart = null;

const dateFilterInput = document.getElementById("date-filter");
const regionFilterInput = document.getElementById("region-filter");

// Initialize filters
dateFilterInput.value = dateFilter;

dateFilterInput.onchange = (e) => {
    dateFilter = e.target.value;
    updateUI();
};

regionFilterInput.onchange = (e) => {
    regionFilter = e.target.value;
    updateUI();
};

async function fetchNews() {
    try {
        const response = await fetch("/api/news");
        const data = await response.json();
        // Normalize categories
        allNewsItems = data.map(item => ({
            ...item,
            crime_type: (item.crime_type === "အထွေထွေနှင့် ဝန်ဆောင်မှု" || item.crime_type === "အထွေထွေ") ? "အထွေထွေ" : 
                       (item.crime_type === "တိုက်ပွဲသတင်း") ? "စစ်ရေးသတင်း" : item.crime_type
        }));
        updateUI();
    } catch (error) {
        console.error("Error fetching news:", error);
    }
}

function updateUI() {
    const selectedDate = dateFilterInput.value;
    const selectedRegion = regionFilterInput.value;

    const filtered = allNewsItems.filter((item) => {
        // Normalize item date to YYYY-MM-DD
        const itemDateStr = item.event_date || item.publish_date || "";
        const itemDate = itemDateStr.toString().split('T')[0].split(' ')[0];
        
        const matchesDate = !selectedDate || itemDate === selectedDate;
        const matchesRegion = selectedRegion === "All" || (item.region && item.region.includes(selectedRegion));
        const matchesType = (currentFilter === "All" || item.crime_type === currentFilter);
        
        return matchesDate && matchesRegion && matchesType;
    });

    // Update Top Stats based on current region/date but spanning categories
    updateFilters(allNewsItems.filter(i => {
        const itemDateStr = i.event_date || i.publish_date || "";
        const itemDate = itemDateStr.toString().split('T')[0].split(' ')[0];
        const matchesRegion = selectedRegion === "All" || (i.region && i.region.includes(selectedRegion));
        return (!selectedDate || itemDate === selectedDate) && matchesRegion;
    }));
    
    updateMapMarkers(filtered);
    renderCharts(filtered);
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
        
        // Build sub-category list
        let subHtml = "";
        const subs = SUB_CATEGORIES[cat] || [];
        if (subs.length > 0) {
            subHtml = `<div class="sub-counts">`;
            subs.forEach(sub => {
                const subCount = filteredItems.filter(i => i.sub_category === sub).length;
                if (subCount > 0) {
                    subHtml += `<div class="sub-item"><span>${sub}:</span> <span>${subCount}</span></div>`;
                }
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
            card.classList.toggle("expanded");
        };
        
        topStatsPanel.appendChild(card);
    });
}

function renderCharts(items) {
    // 1. Category Stats (Donut Chart)
    const categoryCounts = {};
    ALL_CATEGORIES.forEach(cat => categoryCounts[cat] = 0);
    
    items.forEach(item => {
        const cat = item.crime_type;
        if (categoryCounts.hasOwnProperty(cat)) {
            categoryCounts[cat]++;
        }
    });

    if (!categoryChart) {
        categoryChart = echarts.init(document.getElementById('categoryChart'));
        // Add click integration to donut chart
        categoryChart.on('click', (params) => {
            if (params.name) {
                currentFilter = (currentFilter === params.name) ? "All" : params.name;
                updateUI();
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
            textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '500' },
            icon: 'circle',
            pageButtonGap: 5,
            pageIconColor: '#f7b731',
            pageIconInactiveColor: 'rgba(255,255,255,0.2)',
            pageTextStyle: { color: '#fff' }
        },
        series: [{
            name: '',
            type: 'pie',
            radius: '80%', // "Close ring" into solid pie for better visibility on the right
            center: ['72%', '50%'], // Move chart to the right
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 4,
                borderColor: '#1a1a1f',
                borderWidth: 1
            },
            label: {
                show: false
            },
            emphasis: {
                label: {
                    show: false
                },
                itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            },
            data: ALL_CATEGORIES.map(cat => ({
                name: cat,
                value: categoryCounts[cat],
                itemStyle: { color: typeColors[cat] || typeColors.Other }
            }))
        }],
        backgroundColor: 'transparent'
    };
    categoryChart.setOption(categoryOption);

    // 2. Events over Time (Monthly Bar Chart for Current Year)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-indexed
    const myanmarMonths = ["ဇန်", "ဖေ", "မတ်", "ဧ", "မေ", "ဇွန်", "ဇူ", "ဩ", "စက်", "အောက်", "နို", "ဒီ"];
    
    // Initialize months up to current
    const monthlyData = [];
    const monthLabels = [];
    for (let i = 0; i <= currentMonth; i++) {
        monthLabels.push(myanmarMonths[i]);
        monthlyData.push(0);
    }

    items.forEach(item => {
        const itemDateStr = item.event_date || item.publish_date;
        if (itemDateStr) {
            const date = new Date(itemDateStr);
            if (date.getFullYear() === currentYear) {
                const m = date.getMonth();
                if (m <= currentMonth) {
                    monthlyData[m]++;
                }
            }
        }
    });
    
    if (!timeChart) {
        timeChart = echarts.init(document.getElementById('timeChart'));
    }

    const timeOption = {
        grid: { left: '3%', right: '4%', bottom: '5%', top: '10%', containLabel: true },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
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
        series: [{
            data: monthlyData,
            type: 'bar',
            barWidth: '60%',
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#f7b731' },
                    { offset: 1, color: '#fa8231' }
                ]),
                borderRadius: [4, 4, 0, 0]
            }
        }],
        backgroundColor: 'transparent'
    };
    timeChart.setOption(timeOption);
    
    // Handle Window Resize
    window.addEventListener('resize', () => {
        if (categoryChart) categoryChart.resize();
        if (timeChart) timeChart.resize();
    });
}

function updateMapMarkers(items) {
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

            const typeLabel = item.crime_type || "အခြား";
            const subLabel = item.sub_category ? `<div style="font-size: 11px; color: ${color}; margin-top: -4px; margin-bottom: 8px; font-weight: 700; opacity: 0.9;"># ${item.sub_category}</div>` : "";
            const typeClass = `type-${typeLabel.split(" ").join("-")}`;

            // Clean Location Info (Region, Township, City)
            const locDetails = [item.region, item.township, item.city].filter(Boolean).join("၊ ");

            marker.bindPopup(
                `
                <div style="font-family: 'Inter', sans-serif; padding: 5px; color: #fff;">
                    <div class="type-tag ${typeClass}" style="margin-bottom:8px">${typeLabel}</div>
                    ${subLabel}
                    <strong style="display:block; margin-bottom:4px; font-size:14px;">${locDetails || item.location_name}</strong>
                    <div style="font-size: 12px; opacity: 0.8; margin-top:8px;">
                        <div>📅 ဖြစ်ပွားရက်: ${item.event_date || "မသိရ"}</div>
                        <div>⏰ ဖြစ်ပွားချိန်: ${item.event_time || "မသိရ"}</div>
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
dateFilterInput.onchange = (e) => {
    dateFilter = e.target.value;
    updateUI();
};
regionFilterInput.onchange = (e) => {
    regionFilter = e.target.value;
    updateUI();
};

// Initial Fetch
fetchNews();
setInterval(fetchNews, 30000); // Live refresh every 30 seconds
lucide.createIcons();
