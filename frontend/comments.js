// API Configuration - Injected at build time
const API_BASE_URL = '__INJECT_API_BASE_URL__';
const API_KEY = '__INJECT_API_KEY__';

// Global variables
let newsId = null;
let currentNewsItem = null;
let currentUser = null;

// Parse Query String
function getNewsIdParam() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Toast helper
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

// User credentials check
async function checkAuthSession() {
    const token = localStorage.getItem("bd_token");
    const username = localStorage.getItem("bd_username");
    
    if (!token || !username) {
        currentUser = null;
        renderAuthUI();
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
            localStorage.removeItem("bd_token");
            localStorage.removeItem("bd_username");
            currentUser = null;
        }
    } catch (e) {
        currentUser = { token, username }; // offline bypass
    }
    renderAuthUI();
}

function renderAuthUI() {
    const statusBadge = document.getElementById("auth-status-badge");
    const formBlock = document.getElementById("comment-form-block");
    
    if (currentUser) {
        if (statusBadge) {
            statusBadge.innerHTML = `
                <i data-lucide="user" style="color: var(--primary-color); width: 16px; height: 16px;"></i>
                <span>${escapeHTML(currentUser.username)}</span>
            `;
        }
        if (formBlock) {
            formBlock.innerHTML = `
                <div class="comment-form">
                    <div class="mod-warning" id="mod-warning-block">
                        <i data-lucide="alert-triangle"></i>
                        <span id="mod-warning-text">Comment rejected</span>
                    </div>
                    <textarea id="comment-text-input" class="comment-textarea" placeholder="သတင်းအပေါ် သင့်အမြင်အား ယဉ်ကျေးစွာ မှတ်ချက်ပေးပါ..." maxlength="500"></textarea>
                    <div class="comment-actions">
                        <button class="submit-btn" onclick="submitComment()">Add Comment</button>
                    </div>
                </div>
            `;
        }
    } else {
        if (statusBadge) {
            statusBadge.innerHTML = `<span>Guest mode</span>`;
        }
        if (formBlock) {
            formBlock.innerHTML = `
                <div class="non-auth-prompt">
                    မှတ်ချက်ပေးရန် <span class="auth-link" onclick="redirectToLogin()">အကောင့်ဝင်ပါ သို့မဟုတ် အကောင့်ဆောက်ပါ</span>။
                </div>
            `;
        }
    }
    lucide.createIcons();
}

function redirectToLogin() {
    // Redirect user back to feed page and trigger login overlay
    window.location.href = "feed.html?triggerAuth=login";
}

// Fetch single news details
async function fetchNewsDetails() {
    const spinner = document.getElementById("news-details-spinner");
    const content = document.getElementById("news-details-content");
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/news/${newsId}`, {
            headers: { "X-API-Key": API_KEY }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                if (spinner) spinner.style.display = "none";
                document.getElementById("news-title").innerText = "သတင်းရှာမတွေ့ပါ။";
                if (content) content.style.display = "block";
                return;
            }
            throw new Error("Failed to load news details");
        }
        
        const target = await response.json();
        currentNewsItem = target;
        renderNewsDetails();
        
        // After news detail resolves, fetch comments
        await fetchComments();
        
    } catch (e) {
        console.error(e);
        showToast("Error retrieving event details.", true);
    }
}

function renderNewsDetails() {
    const spinner = document.getElementById("news-details-spinner");
    const content = document.getElementById("news-details-content");
    
    if (spinner) spinner.style.display = "none";
    if (!currentNewsItem) return;
    
    document.getElementById("news-title").innerText = currentNewsItem.summary || currentNewsItem.raw_text || "ဖြစ်စဉ်အကျဉ်း";
    
    const catBadge = document.getElementById("news-category");
    if (catBadge) {
        catBadge.innerText = currentNewsItem.crime_type || "အထွေထွေ";
        
        const typeColors = {
            'စစ်ရေးသတင်း': '#e74c3c',
            'မှုခင်းသတင်း': '#9b59b6',
            'မတော်တဆဖြစ်မှု': '#f1c40f',
            'သဘာဝဘေးအန္တရာယ်': '#e67e22',
            'အထွေထွေ': '#3498db'
        };
        const badgeColor = typeColors[currentNewsItem.crime_type] || '#7f8c8d';
        catBadge.style.color = badgeColor;
    }
    
    const location = [currentNewsItem.region, currentNewsItem.city, currentNewsItem.township].filter(s => s && s !== 'မသိရ').join(', ') || 'မြန်မာ';
    document.getElementById("news-location").innerText = location;
    
    const dateStr = formatDateDisplay(currentNewsItem.publish_date || currentNewsItem.event_date);
    const timeStr = formatTime12h(currentNewsItem.publish_time || currentNewsItem.event_time);
    document.getElementById("news-date").innerText = `${dateStr} ${timeStr}`;
    
    document.getElementById("news-source").innerText = currentNewsItem.source_name || currentNewsItem.channel_handle || "Unknown source";
    
    const rawBox = document.getElementById("news-raw-text");
    if (rawBox && currentNewsItem.raw_text) {
        // Solution B optimization: Remove URLs and Hashtags from rendering
        let cleanedText = currentNewsItem.raw_text
            .replace(/https?:\/\/\S+/gi, "")
            .replace(/#\S+/g, "")
            .replace(/\n\s*\n/g, "\n")
            .trim();
        rawBox.innerText = cleanedText;
    } else if (rawBox) {
        rawBox.style.display = "none";
    }
    
    if (content) content.style.display = "block";
}

// Comments retriever logic
async function fetchComments() {
    const commentsSpinner = document.getElementById("comments-spinner");
    const commentsList = document.getElementById("comments-list");
    
    if (commentsSpinner) commentsSpinner.style.display = "block";
    if (commentsList) commentsList.innerHTML = "";
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/news/${newsId}/comments`, {
            headers: { "X-API-Key": API_KEY }
        });
        
        if (!response.ok) throw new Error("Comments fetch failed");
        const list = await response.json();
        
        if (commentsSpinner) commentsSpinner.style.display = "none";
        
        if (!list || list.length === 0) {
            commentsList.innerHTML = `
                <div class="empty-comments">
                    မှတ်ချက် တစ်ခုမှ မရှိသေးပါ။ ပထမဆုံးအကြံပြုချက် ရေးသားလိုက်ပါ!
                </div>
            `;
            return;
        }
        
        list.forEach(comment => {
            const date = new Date(comment.created_at);
            const timeAgo = formatTimeAgo(date);
            
            const commentEl = document.createElement("div");
            commentEl.className = "comment-item";
            commentEl.innerHTML = `
                <div class="comment-meta">
                    <span class="comment-author">${escapeHTML(comment.username)}</span>
                    <span class="meta-separator">•</span>
                    <span>${escapeHTML(timeAgo)}</span>
                </div>
                <div class="comment-text">${escapeHTML(comment.comment_text)}</div>
            `;
            commentsList.appendChild(commentEl);
        });
        
    } catch (e) {
        console.error(e);
        if (commentsSpinner) commentsSpinner.style.display = "none";
        if (commentsList) {
            commentsList.innerHTML = `<div class="empty-comments" style="color: var(--accent-color)">မှတ်ချက်များ ဖတ်ရှုမရပါ။</div>`;
        }
    }
}

// Comments submit engine
async function submitComment() {
    const textInput = document.getElementById("comment-text-input");
    const warningBlock = document.getElementById("mod-warning-block");
    const warningText = document.getElementById("mod-warning-text");
    
    if (warningBlock) warningBlock.style.display = "none";
    
    if (!textInput) return;
    const comment_text = textInput.value.trim();
    
    if (!comment_text) {
        showToast("Please enter comment text.", true);
        return;
    }
    
    if (!currentUser) {
        showToast("Session authentication missing. Please login again.", true);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/news/${newsId}/comments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": API_KEY,
                "Authorization": `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({ comment_text })
        });
        
        const data = await response.json();
        if (response.ok) {
            textInput.value = "";
            showToast("Comment added successfully!");
            // Refresh comments
            await fetchComments();
        } else {
            // Moderated block or API failure
            if (response.status === 400 && data.detail) {
                // Show safety warning warning block to user
                if (warningBlock && warningText) {
                    warningText.innerText = data.detail;
                    warningBlock.style.display = "flex";
                    lucide.createIcons();
                }
                showToast("Comment failed safety guidelines check.", true);
            } else {
                showToast(data.detail || "Failed to post comment.", true);
            }
        }
    } catch (e) {
        console.error(e);
        showToast("Server connection error. Please try again.", true);
    }
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

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = Math.floor(seconds / 31536000);
    
    if (interval >= 1) return `${interval}y ago`;
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval}mo ago`;
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval}d ago`;
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval}h ago`;
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval}m ago`;
    return 'just now';
}

// Initial initialization
async function initComments() {
    newsId = getNewsIdParam();
    if (!newsId) {
        document.getElementById("news-details-spinner").style.display = "none";
        document.getElementById("news-title").innerText = "သတင်းမှတ်ပုံတင် ID မမှန်ကန်ပါ။";
        return;
    }
    
    await checkAuthSession();
    await fetchNewsDetails();
}

document.addEventListener("DOMContentLoaded", initComments);
