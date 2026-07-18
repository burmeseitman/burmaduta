// API Configuration - Injected at build time
const API_BASE_URL = '__INJECT_API_BASE_URL__';
const API_KEY = '__INJECT_API_KEY__';

// Global variables
let allNewsItems = [];
let currentCategory = 'All';
let existingIds = new Set();
let autoPollTimer = null;
let currentPage = 1;
const itemsLimit = 30;

// Auth Session Management
let currentUser = null; // { token, username }

// Detect back mapping redirect link based on device
function setupRedirectLink() {
    const btnBack = document.getElementById("btn-back-map");
    if (btnBack) {
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            btnBack.href = "mobile.html";
        } else {
            btnBack.href = "index.html";
        }
    }
}

// Toast Helpers
function showToast(message, isError = false) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    
    const toast = document.createElement("div");
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.innerHTML = `
        <i data-lucide="${isError ? 'alert-circle' : 'check-circle'}" style="color: ${isError ? '#eb3b5a' : '#f7b731'}"></i>
        <div class="toast-text">${escapeHTML(message)}</div>
    `;
    container.appendChild(toast);
    lucide.createIcons();
    
    // Animate in
    setTimeout(() => toast.classList.add("show"), 50);
    
    // Destroy after 3.5s
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Fetch session user
async function checkAuthSession() {
    const token = localStorage.getItem("bd_token");
    const username = localStorage.getItem("bd_username");
    
    if (!token || !username) {
        currentUser = null;
        renderAuthHeader();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: {
                "X-API-Key": API_KEY,
                "Authorization": `Bearer ${token}`
            }
        });
        if (response.ok) {
            currentUser = { token, username };
        } else {
            // Expired or bad token
            localStorage.removeItem("bd_token");
            localStorage.removeItem("bd_username");
            currentUser = null;
        }
    } catch (e) {
        console.error("Auth session check failed:", e);
        // Fallback keep offline credentials until failure verify on post
        currentUser = { token, username };
    }
    renderAuthHeader();
}

function renderAuthHeader() {
    const container = document.getElementById("auth-header-section");
    if (!container) return;
    
    if (currentUser) {
        container.innerHTML = `
            <div class="user-badge">
                <i data-lucide="user" style="width: 16px; height: 16px;"></i>
                <span>${escapeHTML(currentUser.username)}</span>
            </div>
            <button class="auth-btn" onclick="handleLogout()">Sign Out</button>
        `;
    } else {
        container.innerHTML = `
            <button class="auth-btn" onclick="openAuthModal('login')">Sign In</button>
        `;
    }
    lucide.createIcons();
}

// Modals Trigger Handlers
function openAuthModal(type) {
    closeAuthModals();
    const modal = document.getElementById(`${type}-modal`);
    if (modal) {
        modal.style.display = 'flex';
        // Clear error messaging
        document.getElementById(`${type}-error`).style.display = 'none';
    }
}

function closeAuthModals() {
    document.getElementById("login-modal").style.display = 'none';
    document.getElementById("register-modal").style.display = 'none';
}

function switchAuthModal(toType) {
    closeAuthModals();
    openAuthModal(toType);
}

// Auth Submissions
async function handleLoginSubmit() {
    const userEl = document.getElementById("login-username");
    const passEl = document.getElementById("login-password");
    const errEl = document.getElementById("login-error");
    
    const username = userEl.value.trim();
    const password = passEl.value;
    
    if (!username || !password) {
        errEl.innerText = "Please fill in all fields.";
        errEl.style.display = "block";
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": API_KEY
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem("bd_token", data.token);
            localStorage.setItem("bd_username", data.username);
            currentUser = { token: data.token, username: data.username };
            closeAuthModals();
            renderAuthHeader();
            showToast("Logged in successfully!");
            // Clear inputs
            userEl.value = "";
            passEl.value = "";
        } else {
            errEl.innerText = data.detail || "Authentication failed.";
            errEl.style.display = "block";
        }
    } catch (err) {
        errEl.innerText = "Connection error. Please try again.";
        errEl.style.display = "block";
    }
}

async function handleRegisterSubmit() {
    const userEl = document.getElementById("register-username");
    const passEl = document.getElementById("register-password");
    const errEl = document.getElementById("register-error");
    
    const username = userEl.value.trim();
    const password = passEl.value;
    
    if (!username || !password) {
        errEl.innerText = "Please fill in all fields.";
        errEl.style.display = "block";
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": API_KEY
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        if (response.ok) {
            showToast("Account created! Please sign in.");
            switchAuthModal('login');
            // Populate login field
            document.getElementById("login-username").value = username;
            // Clear fields
            userEl.value = "";
            passEl.value = "";
        } else {
            errEl.innerText = data.detail || "Registration failed.";
            errEl.style.display = "block";
        }
    } catch (err) {
        errEl.innerText = "Connection error. Please try again.";
        errEl.style.display = "block";
    }
}

function handleLogout() {
    localStorage.removeItem("bd_token");
    localStorage.removeItem("bd_username");
    currentUser = null;
    renderAuthHeader();
    showToast("Signed out successfully.");
}

// News Fetcher Engine (Auto Poll and Updates)
async function fetchNews(isInitial = false) {
    try {
        const offset = (currentPage - 1) * itemsLimit;
        const response = await fetch(`${API_BASE_URL}/api/news?days=90&limit=${itemsLimit}&offset=${offset}`, {
            headers: {
                "X-API-Key": API_KEY
            }
        });
        
        if (!response.ok) throw new Error("API request failed");
        const news = await response.json();
        
        allNewsItems = news;
        renderFeedList(isInitial);
    } catch (e) {
        console.error("Error fetching news:", e);
        if (isInitial) {
            const listContainer = document.getElementById("feed-list");
            const spinner = document.getElementById("feed-spinner");
            const pagContainer = document.getElementById("pagination-container");
            if (spinner) spinner.style.display = "none";
            if (pagContainer) pagContainer.style.display = "none";
            if (listContainer) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <i data-lucide="wifi-off" style="width: 48px; height: 48px; color: var(--accent-color);"></i>
                        <p>ဒေတာရယူ၍မရပါ။ ကွန်နက်ရှင် ပြန်လည်စစ်ဆေးပေးပါ...</p>
                    </div>
                `;
                listContainer.style.display = "block";
                lucide.createIcons();
            }
        }
    }
}

function renderFeedList(isInitial = false) {
    const listContainer = document.getElementById("feed-list");
    const spinner = document.getElementById("feed-spinner");
    const pagContainer = document.getElementById("pagination-container");
    if (spinner) spinner.style.display = "none";
    if (!listContainer) return;
    
    // Apply Category filtering logic
    let filteredItems = allNewsItems;
    if (currentCategory !== 'All') {
        filteredItems = allNewsItems.filter(item => item.crime_type === currentCategory);
    }
    
    if (filteredItems.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="database" style="width: 40px; height: 40px;"></i>
                <p>ဤအမျိုးအစားအတွက် သတင်းမှတ်တမ်းမရှိသေးပါ။</p>
            </div>
        `;
        listContainer.style.display = "block";
        if (pagContainer) pagContainer.style.display = "none";
        lucide.createIcons();
        return;
    }
    
    const newIdsThisPoll = new Set(filteredItems.map(item => item.id));
    
    listContainer.innerHTML = "";
    
    filteredItems.forEach((item, index) => {
        const itemId = item.id;
        const number = (currentPage - 1) * itemsLimit + index + 1;
        const summaryText = item.summary || item.raw_text || "No details provided";
        const trimmedTitle = summaryText.length > 120 ? summaryText.substring(0, 117) + "..." : summaryText;
        
        const typeColors = {
            'စစ်ရေးသတင်း': '#e74c3c',
            'မှုခင်းသတင်း': '#9b59b6',
            'မတော်တဆဖြစ်မှု': '#f1c40f',
            'သဘာဝဘေးအန္တရာယ်': '#e67e22',
            'အထွေထွေ': '#3498db'
        };
        const badgeColor = typeColors[item.crime_type] || '#7f8c8d';
        
        // Metadata processing
        const dateStr = formatDateDisplay(item.publish_date || item.event_date);
        const timeStr = formatTime12h(item.publish_time || item.event_time);
        const source = item.source_name || item.channel_handle || "Unknown source";
        const location = [item.region, item.city, item.township].filter(s => s && s !== 'မသိရ').join(', ') || 'မြန်မာ';
        
        // Setup item element wrapper
        const itemEl = document.createElement("div");
        itemEl.className = "feed-item";
        
        // Dynamic highlight animation on new items
        if (!isInitial && !existingIds.has(itemId)) {
            itemEl.classList.add("flash-highlight");
        }
        
        itemEl.innerHTML = `
            <span class="item-number">${number}.</span>
            <div class="item-main">
                <div class="item-title-row">
                    <a href="comments.html?id=${itemId}" class="item-title">${escapeHTML(trimmedTitle)}</a>
                    <span class="item-source">(${escapeHTML(source)})</span>
                </div>
                <div class="item-meta">
                    <span class="category-badge" style="color: ${badgeColor};">${escapeHTML(item.crime_type || 'အထွေထွေ')}</span>
                    <span class="meta-separator">|</span>
                    <span>${escapeHTML(location)}</span>
                    <span class="meta-separator">|</span>
                    <span>${escapeHTML(dateStr)} ${escapeHTML(timeStr)}</span>
                    <span class="meta-separator">|</span>
                    <a href="comments.html?id=${itemId}" class="comments-link">discuss/comments</a>
                </div>
            </div>
        `;
        listContainer.appendChild(itemEl);
    });
    
    // Manage Pagination Visibility: show More button if records returned match maximum itemsLimit
    if (pagContainer) {
        if (filteredItems.length >= itemsLimit) {
            pagContainer.style.display = "block";
        } else {
            pagContainer.style.display = "none";
        }
    }
    
    // Save existing set of IDs
    existingIds = newIdsThisPoll;
    listContainer.style.display = "block";
    lucide.createIcons();
}

// Category filter trigger click
function setupCategoryFilters() {
    const buttons = document.querySelectorAll(".filter-btn");
    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentCategory = btn.getAttribute("data-category");
            currentPage = 1; // Reset back to page 1
            fetchNews(true); // Fetch immediately
        });
    });
}

// Helpers
function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
        `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` 
        : '255, 255, 255';
}

function formatDateDisplay(dateStr) {
    if (!dateStr || dateStr === "null") return "မသိရ";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const d = String(date.getDate()).padStart(2, '0');
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const m = months[date.getMonth()];
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    } catch (e) {
        return dateStr;
    }
}

function formatTime12h(timeStr) {
    if (!timeStr || timeStr === "မသိရ") return "";
    try {
        const parts = timeStr.split(':');
        let hours = parseInt(parts[0]);
        if (isNaN(hours)) return timeStr;
        const minutes = String(parts[1] || "00").substring(0, 2);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${hours}:${minutes} ${ampm}`;
    } catch (e) {
        return timeStr;
    }
}

// Engine Init configurations
async function initApp() {
    setupRedirectLink();
    await checkAuthSession();
    setupCategoryFilters();
    
    // Bind More pagination button click
    const moreBtn = document.getElementById("more-news-btn");
    if (moreBtn) {
        moreBtn.addEventListener("click", (e) => {
            e.preventDefault();
            currentPage++;
            fetchNews(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Check if auth trigger from query parameter is present
    const urlParams = new URLSearchParams(window.location.search);
    const triggerAuth = urlParams.get('triggerAuth');
    if (triggerAuth === 'login' || triggerAuth === 'register') {
        openAuthModal(triggerAuth);
    }
    
    // Initial fetch
    await fetchNews(true);
    
    // Set auto updates short polling interval (10 seconds)
    autoPollTimer = setInterval(() => {
        fetchNews(false);
    }, 10000);
}

document.addEventListener("DOMContentLoaded", initApp);
