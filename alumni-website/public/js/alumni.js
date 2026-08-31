/**
 * Alumni Directory - Page Logic
 * Fetches paginated alumni from /api/users/directory with debounced search,
 * filters (from real /directory/facets data), sorting, and public profile links.
 */

const DIRECTORY_PAGE_SIZE = 12;
const DIRECTORY_DEBOUNCE_MS = 300;

const directoryState = {
  q: '',
  department: '',
  degree: '',
  location: '',
  graduationYear: '',
  mentorship: '',
  sort: 'name_asc',
  page: 1,
  requestId: 0
};

document.addEventListener('DOMContentLoaded', function () {
  const token = localStorage.getItem('token');
  if (!token) {
    // The directory is member data - redirect to login like profile.html does
    window.location.href = 'portal.html#login';
    return;
  }

  initDirectoryControls();
  loadFacets(token);
  loadDirectory(token);
});

function initDirectoryControls() {
  const searchInput = document.getElementById('directory-search');
  searchInput.addEventListener('input', function () {
    directoryState.q = this.value.trim();
    directoryState.page = 1;
    debounceDirectoryLoad();
  });

  const filterStateKeys = {
    'filter-department': 'department',
    'filter-degree': 'degree',
    'filter-location': 'location',
    'filter-year': 'graduationYear'
  };

  Object.keys(filterStateKeys).forEach(function (id) {
    document.getElementById(id).addEventListener('change', function () {
      directoryState[filterStateKeys[id]] = this.value;
      directoryState.page = 1;
      loadDirectory(getToken());
    });
  });

  document.getElementById('filter-mentorship').addEventListener('change', function () {
    directoryState.mentorship = this.checked ? 'available' : '';
    directoryState.page = 1;
    loadDirectory(getToken());
  });

  document.getElementById('directory-sort').addEventListener('change', function () {
    directoryState.sort = this.value;
    directoryState.page = 1;
    loadDirectory(getToken());
  });

  document.getElementById('reset-filters').addEventListener('click', resetFilters);
  document.getElementById('empty-clear-filters').addEventListener('click', resetFilters);
  document.getElementById('retry-load').addEventListener('click', function () {
    loadDirectory(getToken());
  });

  document.getElementById('page-prev').addEventListener('click', function () {
    if (directoryState.page > 1) {
      directoryState.page -= 1;
      loadDirectory(getToken());
    }
  });

  document.getElementById('page-next').addEventListener('click', function () {
    directoryState.page += 1;
    loadDirectory(getToken());
  });
}

function getToken() {
  return localStorage.getItem('token');
}

let debounceTimer = null;
function debounceDirectoryLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function () {
    loadDirectory(getToken());
  }, DIRECTORY_DEBOUNCE_MS);
}

function resetFilters() {
  directoryState.q = '';
  directoryState.department = '';
  directoryState.degree = '';
  directoryState.location = '';
  directoryState.graduationYear = '';
  directoryState.sort = 'name_asc';
  directoryState.page = 1;

  document.getElementById('directory-search').value = '';
  document.getElementById('directory-sort').value = 'name_asc';
  document.getElementById('filter-mentorship').checked = false;
  ['filter-department', 'filter-degree', 'filter-location', 'filter-year'].forEach(function (id) {
    document.getElementById(id).value = '';
  });

  loadDirectory(getToken());
}

/**
 * Load distinct filter values from real user data.
 */
async function loadFacets(token) {
  try {
    const response = await fetch('/api/users/directory/facets', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return; // filters stay as "All …" on failure

    const facets = await response.json();
    fillSelect('filter-department', facets.departments);
    fillSelect('filter-degree', facets.degrees);
    fillSelect('filter-location', facets.locations);
    fillSelect('filter-year', (facets.graduationYears || []).map(String));
  } catch (error) {
    // Non-fatal: the directory still works without dynamic filter options
    console.error('Could not load directory filters:', error.message);
  }
}

function fillSelect(selectId, values) {
  const select = document.getElementById(selectId);
  if (!select || !Array.isArray(values)) return;
  values.forEach(function (value) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

/**
 * Fetch one directory page and render it.
 */
async function loadDirectory(token) {
  const grid = document.getElementById('directory-grid');
  const loading = document.getElementById('directory-loading');
  const emptyState = document.getElementById('directory-empty');
  const errorState = document.getElementById('directory-error');
  const pagination = document.getElementById('directory-pagination');
  const meta = document.getElementById('directory-meta');

  const requestId = ++directoryState.requestId;

  // Show loading state, hide everything else
  grid.innerHTML = '';
  grid.classList.add('hidden');
  emptyState.classList.add('hidden');
  errorState.classList.add('hidden');
  pagination.classList.add('hidden');
  meta.textContent = '';
  loading.classList.remove('hidden');
  renderSkeletons();

  const params = new URLSearchParams();
  params.set('page', directoryState.page);
  params.set('limit', DIRECTORY_PAGE_SIZE);
  if (directoryState.q) params.set('q', directoryState.q);
  if (directoryState.department) params.set('department', directoryState.department);
  if (directoryState.degree) params.set('degree', directoryState.degree);
  if (directoryState.location) params.set('location', directoryState.location);
  if (directoryState.graduationYear) params.set('graduationYear', directoryState.graduationYear);
  if (directoryState.mentorship) params.set('mentorship', directoryState.mentorship);
  if (directoryState.sort) params.set('sort', directoryState.sort);

  try {
    const response = await fetch(`/api/users/directory?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // A newer request has taken over - ignore this response
    if (requestId !== directoryState.requestId) return;

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('userData');
      localStorage.removeItem('user');
      window.location.href = 'portal.html#login';
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to load the directory');
    }

    const data = await response.json();
    const users = data.users || [];
    const pagination = data.pagination || { page: 1, pages: 1, total: 0 };

    loading.classList.add('hidden');

    if (users.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    grid.innerHTML = users.map(createAlumniCardHtml).join('');
    grid.classList.remove('hidden');

    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    meta.textContent = `Showing ${start}–${end} of ${pagination.total} alumni`;

    renderPagination(pagination);
  } catch (error) {
    if (requestId !== directoryState.requestId) return;
    loading.classList.add('hidden');
    errorState.classList.remove('hidden');
  }
}

function renderSkeletons() {
  const loading = document.getElementById('directory-loading');
  loading.innerHTML = '';
  for (let i = 0; i < DIRECTORY_PAGE_SIZE; i++) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl shadow-lg p-6';
    card.innerHTML = `
      <div class="flex flex-col items-center text-center">
        <div class="skeleton w-24 h-24 rounded-full mb-4"></div>
        <div class="skeleton h-4 w-3/4 mb-2"></div>
        <div class="skeleton h-3 w-1/2 mb-4"></div>
        <div class="skeleton h-3 w-2/3 mb-2"></div>
        <div class="skeleton h-3 w-1/2"></div>
      </div>`;
    loading.appendChild(card);
  }
}

function createAlumniCardHtml(user) {
  const profile = user.profile || {};
  const name = user.name || 'Alumni Member';

  const image = profile.profileImageThumbnail || profile.profileImage || 'images/singlee person.webp';
  const title = profile.title || 'Alumni Member';
  const company = profile.company || '';
  const year = profile.graduationYear || '';
  const degreeDept = [profile.degree, profile.department].filter(Boolean).join(' · ');
  const location = profile.location || '';
  const skills = (profile.skills || [])
    .map(function (skill) { return skill.name; })
    .filter(Boolean)
    .slice(0, 3);

  const profileUrl = `profile.html?id=${encodeURIComponent(user._id)}`;

  const mentorshipBadge = profile.openToMentorship
    ? `<div class="w-full mb-3"><span class="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-teal bg-teal-50 px-2 py-0.5 rounded-full"><i class="fas fa-hands-helping" aria-hidden="true"></i>Available for mentorship</span></div>`
    : '';

  return `
    <article class="alumni-card bg-white rounded-2xl shadow-lg overflow-hidden transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 flex flex-col">
      <div class="p-6 flex flex-col items-center text-center flex-1">
        <img src="${escapeAttr(image)}" alt="Profile photo of ${escapeHtml(name)}"
          class="w-24 h-24 rounded-full object-cover border-4 border-indigo-100 mb-4"
          onerror="this.onerror=null;this.src='images/singlee person.webp'" />
        <h3 class="text-lg font-bold text-gray-900">${escapeHtml(name)}</h3>
        <p class="text-sm text-primary-indigo font-medium">${escapeHtml(title)}</p>
        ${company ? `<p class="text-sm text-gray-500 mb-3">${escapeHtml(company)}</p>` : '<p class="mb-3"></p>'}
        <p class="text-xs text-gray-500 mb-1">${escapeHtml(degreeDept)}${year ? ` · Class of ${escapeHtml(String(year))}` : ''}</p>
        ${location ? `<p class="text-xs text-gray-400 mb-3"><i class="fas fa-location-dot mr-1" aria-hidden="true"></i>${escapeHtml(location)}</p>` : '<p class="mb-3"></p>'}
        ${mentorshipBadge}
        ${skills.length ? `
          <div class="flex flex-wrap justify-center gap-1.5 mt-auto pt-3">
            ${skills.map(function (skill) { return `<span class="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">${escapeHtml(skill)}</span>`; }).join('')}
          </div>` : '<div class="mt-auto"></div>'}
      </div>
      <a href="${escapeAttr(profileUrl)}"
        class="alumni-card-cta block bg-primary-indigo text-white text-center py-2.5 text-sm font-semibold hover:bg-primary-dark-blue transition">
        View Profile
      </a>
      <a href="chat.html?to=${encodeURIComponent(user._id)}"
        class="block text-center py-2 text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-primary-indigo transition">
        <i class="fas fa-comment-dots mr-1" aria-hidden="true"></i>Message
      </a>
    </article>`;
}

function renderPagination(pagination) {
  const nav = document.getElementById('directory-pagination');
  const numbers = document.getElementById('page-numbers');
  const prev = document.getElementById('page-prev');
  const next = document.getElementById('page-next');

  if (!pagination.pages || pagination.pages <= 1) {
    nav.classList.add('hidden');
    return;
  }

  nav.classList.remove('hidden');
  prev.disabled = pagination.page <= 1;
  next.disabled = pagination.page >= pagination.pages;

  // Windowed page numbers: 1 … (p-1) p (p+1) … last
  const pagesToShow = new Set([1, pagination.pages, pagination.page - 1, pagination.page, pagination.page + 1]);
  const list = Array.from(pagesToShow)
    .filter(function (p) { return p >= 1 && p <= pagination.pages; })
    .sort(function (a, b) { return a - b; });

  numbers.innerHTML = '';
  let previous = 0;
  list.forEach(function (p) {
    if (p - previous > 1) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'px-2 text-gray-400 text-sm';
      ellipsis.textContent = '…';
      ellipsis.setAttribute('aria-hidden', 'true');
      numbers.appendChild(ellipsis);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = p;
    button.setAttribute('aria-label', `Page ${p}`);
    if (p === pagination.page) {
      button.setAttribute('aria-current', 'page');
      button.className = 'w-9 h-9 rounded-lg bg-primary-indigo text-white text-sm font-semibold';
    } else {
      button.className = 'w-9 h-9 rounded-lg bg-white border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-100 transition';
      button.addEventListener('click', function () {
        directoryState.page = p;
        loadDirectory(getToken());
      });
    }
    numbers.appendChild(button);
    previous = p;
  });
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(text) {
  return escapeHtml(text);
}
