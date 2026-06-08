const API_URL = '';

// DOM Elements
const searchForm = document.getElementById('search-form');
const apiKeyInput = document.getElementById('api-key');
const keywordInput = document.getElementById('keyword');
const languageSelect = document.getElementById('language');
const regionSelect = document.getElementById('region');
const numResultsSelect = document.getElementById('num-results');
const btnSearch = document.getElementById('btn-search');
const toggleKeyBtn = document.getElementById('toggle-key');

const searchCard = document.getElementById('search-card');
const loadingCard = document.getElementById('loading-card');
const loadingText = document.getElementById('loading-text');
const loadingSubtext = document.getElementById('loading-subtext');
const errorCard = document.getElementById('error-card');
const errorText = document.getElementById('error-text');
const btnRetry = document.getElementById('btn-retry');

const resultsSection = document.getElementById('results-section');
const resultsTitle = document.getElementById('results-title');
const statDomains = document.getElementById('stat-domains');
const statResults = document.getElementById('stat-results');
const resultsGrid = document.getElementById('results-grid');

// =============================================
// Toggle API Key Visibility
// =============================================
toggleKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleKeyBtn.setAttribute('aria-label', isPassword ? 'Hide API key' : 'Show API key');
});

// =============================================
// Search Form Submit
// =============================================
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await performSearch();
});

btnRetry.addEventListener('click', async () => {
    errorCard.classList.add('hidden');
    await performSearch();
});

async function performSearch() {
    const apiKey = apiKeyInput.value.trim();
    const keyword = keywordInput.value.trim();
    const language = languageSelect.value;
    const region = regionSelect.value;
    const numResults = parseInt(numResultsSelect.value, 10);

    if (!apiKey || !keyword) return;

    // Show loading state
    showLoading();

    try {
        const response = await fetch(`${API_URL}/api/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword, language, region, apiKey, numResults }),
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Server error: ${response.status}`);
        }

        const data = await response.json();
        hideLoading();
        renderResults(data);
    } catch (err) {
        hideLoading();
        showError(err.message);
    }
}

// =============================================
// UI State Helpers
// =============================================
function showLoading() {
    btnSearch.disabled = true;
    loadingCard.classList.remove('hidden');
    errorCard.classList.add('hidden');
    resultsSection.classList.add('hidden');

    loadingText.textContent = 'Searching Google via SerpAPI…';
    loadingSubtext.textContent = 'This may take a moment (up to 10 API calls for 100 results)';
}

function hideLoading() {
    btnSearch.disabled = false;
    loadingCard.classList.add('hidden');
}

function showError(message) {
    errorCard.classList.remove('hidden');
    errorText.textContent = message;
}

// =============================================
// Render Results
// =============================================
function renderResults(data) {
    const { keyword, totalResults, domainCount, domains } = data;

    resultsSection.classList.remove('hidden');
    resultsTitle.textContent = `Results for "${keyword}"`;
    statDomains.textContent = `${domainCount} domain${domainCount !== 1 ? 's' : ''}`;
    statResults.textContent = `${totalResults} total result${totalResults !== 1 ? 's' : ''}`;

    resultsGrid.innerHTML = '';

    if (domains.length === 0) {
        resultsGrid.innerHTML = `
      <div class="search-card" style="text-align:center; padding:40px;">
        <p style="color:var(--text-secondary);">No results found. Try different keywords.</p>
      </div>
    `;
        return;
    }

    // Sort domains by page count (descending)
    domains.sort((a, b) => b.pageCount - a.pageCount);

    domains.forEach((domain, index) => {
        const card = createDomainCard(domain, index);
        resultsGrid.appendChild(card);
    });
}

function createDomainCard(domain, index) {
    const card = document.createElement('div');
    card.className = 'domain-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const subdomainBadge = domain.subdomains.length > 0
        ? `<span class="badge badge-subdomains">${domain.subdomains.length} subdomain${domain.subdomains.length !== 1 ? 's' : ''}</span>`
        : '';

    const subfolderBadge = domain.subfolders.length > 0
        ? `<span class="badge badge-subfolders">${domain.subfolders.length} subfolder${domain.subfolders.length !== 1 ? 's' : ''}</span>`
        : '';

    // Header
    card.innerHTML = `
    <div class="domain-card-header">
      <div>
        <span class="domain-name">${escapeHtml(domain.rootDomain)}</span>
      </div>
      <div class="domain-badges">
        <span class="badge badge-pages">${domain.pageCount} page${domain.pageCount !== 1 ? 's' : ''}</span>
        ${subdomainBadge}
        ${subfolderBadge}
        <svg class="expand-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>
    <div class="domain-card-body">
      ${renderSubdomains(domain.subdomains)}
      ${renderSubfolders(domain.subfolders)}
      ${renderPages(domain.pages)}
    </div>
  `;

    // Toggle expand/collapse
    const header = card.querySelector('.domain-card-header');
    header.addEventListener('click', () => {
        card.classList.toggle('expanded');
    });

    return card;
}

function renderSubdomains(subdomains) {
    if (subdomains.length === 0) return '';
    return `
    <div class="detail-section">
      <div class="detail-label">Subdomains</div>
      <div class="tag-list">
        ${subdomains.map(s => `<span class="tag tag-subdomain">${escapeHtml(s)}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderSubfolders(subfolders) {
    if (subfolders.length === 0) return '';
    return `
    <div class="detail-section">
      <div class="detail-label">Subfolders</div>
      <div class="tag-list">
        ${subfolders.map(s => `<span class="tag tag-subfolder">${escapeHtml(s)}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderPages(pages) {
    if (pages.length === 0) return '';
    return `
    <div class="detail-section">
      <div class="detail-label">Pages Found</div>
      <ul class="pages-list">
        ${pages.map(p => `
          <li class="page-item">
            <a href="${escapeHtml(p.fullUrl)}" target="_blank" rel="noopener" class="page-url">${escapeHtml(p.fullUrl)}</a>
            ${p.title ? `<div class="page-title">${escapeHtml(p.title)}</div>` : ''}
            ${p.snippet ? `<div class="page-snippet">${escapeHtml(p.snippet)}</div>` : ''}
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

// =============================================
// Utility
// =============================================
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
