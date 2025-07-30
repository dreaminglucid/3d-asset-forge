// Shared navigation header for all pages
const navHeaderHTML = `
<style>
.nav-header {
    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
    padding: 15px 30px;
    border-bottom: 1px solid #333;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

.nav-brand {
    display: flex;
    align-items: center;
    gap: 15px;
    text-decoration: none;
    color: #4a90e2;
    font-size: 1.4rem;
    font-weight: 600;
}

.nav-brand:hover {
    color: #29b6f6;
}

.nav-links {
    display: flex;
    gap: 25px;
    align-items: center;
}

.nav-link {
    color: #aaa;
    text-decoration: none;
    font-size: 1rem;
    padding: 8px 16px;
    border-radius: 20px;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 5px;
}

.nav-link:hover {
    background: rgba(74, 144, 226, 0.2);
    color: #4a90e2;
}

.nav-link.active {
    background: rgba(74, 144, 226, 0.3);
    color: #4a90e2;
}

.nav-stats {
    display: flex;
    gap: 20px;
    font-size: 0.9rem;
    color: #888;
}

.nav-stat {
    display: flex;
    align-items: center;
    gap: 5px;
}

.nav-stat-value {
    color: #4a90e2;
    font-weight: 600;
}

@media (max-width: 768px) {
    .nav-header {
        flex-wrap: wrap;
        gap: 10px;
    }
    
    .nav-stats {
        display: none;
    }
    
    .nav-links {
        width: 100%;
        justify-content: space-around;
    }
}
</style>

<div class="nav-header">
    <a href="/dashboard.html" class="nav-brand">
        <span>🎮</span>
        <span>Hyperscape</span>
    </a>
    
    <div class="nav-links">
        <a href="/dashboard.html" class="nav-link" id="nav-dashboard">
            <span>📊</span>
            <span>Dashboard</span>
        </a>
        <a href="/asset-browser.html" class="nav-link" id="nav-browser">
            <span>🎨</span>
            <span>Assets</span>
        </a>
        <a href="/index.html" class="nav-link" id="nav-generator">
            <span>🔧</span>
            <span>Generate</span>
        </a>
        <a href="/rpg-viewer.html" class="nav-link" id="nav-rpg">
            <span>🎭</span>
            <span>RPG Tools</span>
        </a>
    </div>
    
    <div class="nav-stats" id="nav-stats">
        <div class="nav-stat">
            <span>Total:</span>
            <span class="nav-stat-value" id="nav-total">46</span>
        </div>
        <div class="nav-stat">
            <span>Generated:</span>
            <span class="nav-stat-value" id="nav-generated">4</span>
        </div>
    </div>
</div>
`;

// Insert navigation and set active page
function insertNavigation() {
    // Create container
    const navContainer = document.createElement('div');
    navContainer.innerHTML = navHeaderHTML;
    
    // Insert at the beginning of body
    document.body.insertBefore(navContainer.firstElementChild, document.body.firstChild);
    
    // Set active page
    const currentPage = window.location.pathname;
    if (currentPage.includes('dashboard')) {
        document.getElementById('nav-dashboard').classList.add('active');
    } else if (currentPage.includes('asset-browser')) {
        document.getElementById('nav-browser').classList.add('active');
    } else if (currentPage.includes('index')) {
        document.getElementById('nav-generator').classList.add('active');
    } else if (currentPage.includes('rpg-viewer')) {
        document.getElementById('nav-rpg').classList.add('active');
    }
    
    // Update stats
    updateNavStats();
}

// Update navigation stats
async function updateNavStats() {
    try {
        const response = await fetch('/api/assets');
        if (response.ok) {
            const assets = await response.json();
            const generated = assets.filter(a => !a.metadata?.isPlaceholder).length;
            
            document.getElementById('nav-total').textContent = assets.length;
            document.getElementById('nav-generated').textContent = generated;
        }
    } catch (error) {
        console.error('Failed to update nav stats:', error);
    }
}

// Auto-insert on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertNavigation);
} else {
    insertNavigation();
}