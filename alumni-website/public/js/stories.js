/**
 * Alumni Stories - Page Logic
 * Loads published stories from /api/stories into the page and
 * handles the "Share Your Story" submission form.
 */

document.addEventListener('DOMContentLoaded', function () {
  loadStories();
  initStoryForm();
});

/**
 * Fetch published stories and render them into the container
 * below the static featured-alumni cards.
 */
async function loadStories() {
  const container = document.getElementById('alumni-stories-container');
  if (!container) return;

  try {
    const response = await fetch('/api/stories');
    if (!response.ok) throw new Error('Failed to fetch stories');

    const data = await response.json();
    const stories = data.stories || [];

    if (stories.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 bg-gray-50 rounded-2xl">
          <i class="fas fa-book-open text-4xl text-gray-300 mb-4"></i>
          <p class="text-gray-500 text-lg">No community stories published yet. Be the first to share yours!</p>
        </div>`;
      return;
    }

    container.innerHTML = stories.map(story => createStoryCardHtml(story)).join('');

    // Top sections: spotlight (interview-style cards) + featured grid
    renderSpotlightStories(stories);
    renderFeaturedStories(stories);
  } catch (error) {
    console.error('Could not load stories:', error.message);
    container.innerHTML = `
      <div class="text-center py-12 bg-gray-50 rounded-2xl">
        <p class="text-gray-500">Stories are temporarily unavailable. Please try again later.</p>
      </div>`;
    renderSpotlightError();
    renderFeaturedError();
  }
}

// ── Spotlight (top of page): interview-style cards for the 2 newest stories ──

function renderSpotlightStories(stories) {
  const container = document.getElementById('spotlight-stories');
  if (!container) return;

  const featured = stories.filter(function (story) { return story.isFeatured; });
  const chosen = (featured.length >= 2 ? featured : stories).slice(0, 2);

  if (chosen.length === 0) {
    container.innerHTML = emptyStoriesHtml('No spotlight stories published yet.');
    return;
  }

  container.innerHTML = chosen.map(function (story, index) {
    const authorName = (story.author && story.author.name) || 'Alumni Member';
    const gradYear = (story.author && story.author.profile && story.author.profile.graduationYear) || '';
    const authorImage = (story.author && story.author.profile && (story.author.profile.profileImageThumbnail || story.author.profile.profileImage))
      || 'images/singlee person.webp';
    const imageSide = `
      <div class="${index % 2 === 1 ? 'md:w-1/2 p-6 md:p-8 flex justify-center items-center' : 'md:w-1/2 p-6 md:p-8 flex justify-center items-center'}">
        <img src="${escapeHtml(story.image || 'images/image9.jpg')}" alt="${escapeHtml(story.title)}"
          class="w-full h-auto object-cover rounded-lg shadow-lg" />
      </div>`;
    const textSide = `
      <div class="md:w-1/2 p-6 md:p-8 flex flex-col justify-center">
        <div class="flex items-center gap-3 mb-3">
          <img src="${escapeHtml(authorImage)}" alt="" class="w-10 h-10 rounded-full object-cover border-2 border-indigo-100" />
          <p class="text-sm font-bold text-gray-900">${escapeHtml(authorName)}</p>
        </div>
        <h3 class="text-2xl font-bold text-gray-900 mb-2">${escapeHtml(story.title)}</h3>
        <p class="text-lg text-primary-indigo font-medium mb-4">${gradYear ? `Class of ${escapeHtml(String(gradYear))}` : escapeHtml(story.category || 'Alumni Story')}</p>
        <p class="text-gray-700 leading-relaxed mb-4">“${escapeHtml(story.excerpt || '')}”</p>
        <a href="stories.html" class="inline-block mt-2 text-accent-teal font-semibold hover:text-primary-indigo transition">Read on Stories page</a>
      </div>`;
    return index % 2 === 1
      ? `<div class="bg-gray-100 rounded-2xl shadow-xl overflow-hidden md:flex md:items-center transform transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl mb-8 md:flex-row-reverse">${textSide}${imageSide}</div>`
      : `<div class="bg-gray-100 rounded-2xl shadow-xl overflow-hidden md:flex md:items-center transform transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl mb-8">${imageSide}${textSide}</div>`;
  }).join('');
}

// ── Featured grid: featured stories first, then the newest ones ─────────────

function renderFeaturedStories(stories) {
  const grid = document.getElementById('featured-stories-grid');
  if (!grid) return;

  const featured = stories.filter(function (story) { return story.isFeatured; });
  const chosen = (featured.length ? featured : stories).slice(0, 6);

  if (chosen.length === 0) {
    grid.innerHTML = '<p class="text-gray-500 col-span-full text-center">No featured alumni yet.</p>';
    return;
  }

  grid.innerHTML = chosen.map(function (story) {
    const authorName = (story.author && story.author.name) || 'Alumni Member';
    const title = (story.author && story.author.profile && story.author.profile.title) || story.category || '';
    const gradYear = (story.author && story.author.profile && story.author.profile.graduationYear) || '';
    const authorImage = (story.author && story.author.profile && (story.author.profile.profileImageThumbnail || story.author.profile.profileImage))
      || 'images/singlee person.webp';
    return `
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden transform transition-all duration-500 hover:scale-105 hover:shadow-2xl animate-fadeIn p-6">
        <div class="flex justify-center mb-4">
          <img src="${escapeHtml(authorImage)}" alt="${escapeHtml(authorName)}"
            class="w-32 h-32 object-cover rounded-full shadow-md border-4 border-indigo-100" />
        </div>
        <h3 class="text-xl font-bold text-gray-900 text-center mb-1">${escapeHtml(authorName)}</h3>
        <p class="text-indigo-600 text-center font-medium mb-3">${escapeHtml(title)}${gradYear ? ` · Class of ${escapeHtml(String(gradYear))}` : ''}</p>
        <p class="text-gray-600 text-sm leading-relaxed mb-4">${escapeHtml((story.excerpt || '').substring(0, 160))}…</p>
        <p class="text-xs text-gray-400 text-center"><i class="fas fa-quote-left mr-1"></i>${escapeHtml(story.title)}</p>
      </div>`;
  }).join('');
}

function emptyStoriesHtml(text) {
  return `<div class="text-center py-12 bg-gray-50 rounded-2xl col-span-full">
    <p class="text-gray-400 text-sm">${escapeHtml(text)}</p>
  </div>`;
}

function renderSpotlightError() {
  const container = document.getElementById('spotlight-stories');
  if (container) container.innerHTML = emptyStoriesHtml('Spotlight stories are temporarily unavailable.');
}

function renderFeaturedError() {
  const grid = document.getElementById('featured-stories-grid');
  if (grid) grid.innerHTML = '<p class="text-gray-500 col-span-full text-center">Featured stories are temporarily unavailable.</p>';
}

function createStoryCardHtml(story) {
  const authorName = (story.author && story.author.name) || 'Alumni Member';
  const authorTitle = (story.author && story.author.profile && story.author.profile.title) || '';
  const gradYear = (story.author && story.author.profile && story.author.profile.graduationYear) || '';
  const authorImage = (story.author && story.author.profile && story.author.profile.profileImageThumbnail)
    || (story.author && story.author.profile && story.author.profile.profileImage)
    || 'images/singlee person.webp';

  const defaultImg = 'images/image11.jpg';
  const coverImage = story.image || defaultImg;

  const dateStr = new Date(story.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // First paragraph of the content as preview
  const preview = (story.content || story.excerpt || '').split('\n')[0].substring(0, 320);

  return `
    <article class="bg-white rounded-2xl shadow-lg overflow-hidden transform transition-all duration-300 hover:shadow-2xl mb-8">
      <div class="md:flex">
        <div class="md:w-1/3 p-6 flex justify-center items-start">
          <img src="${coverImage}" alt="${escapeHtml(story.title)}"
            class="w-full h-48 md:h-56 object-cover rounded-xl shadow"
            onerror="this.onerror=null;this.src='${defaultImg}'" />
        </div>
        <div class="md:w-2/3 p-6 md:pr-8">
          <div class="flex items-center gap-3 mb-3">
            <span class="text-xs font-bold uppercase tracking-wider text-accent-teal bg-teal-50 px-3 py-1 rounded-full">${escapeHtml(story.category || 'Story')}</span>
            <span class="text-xs text-gray-400"><i class="far fa-calendar mr-1"></i>${dateStr}</span>
            <span class="text-xs text-gray-400"><i class="far fa-eye mr-1"></i>${story.views || 0}</span>
          </div>
          <h3 class="text-2xl font-bold text-gray-900 mb-2">${escapeHtml(story.title)}</h3>
          <p class="text-gray-600 leading-relaxed mb-4">${escapeHtml(preview)}${preview.length >= 320 ? '…' : ''}</p>
          <div class="flex items-center gap-3">
            <img src="${authorImage}" alt="${escapeHtml(authorName)}"
              class="w-10 h-10 rounded-full object-cover border-2 border-indigo-100"
              onerror="this.onerror=null;this.src='images/singlee person.webp'" />
            <div>
              <p class="text-sm font-semibold text-gray-800">${escapeHtml(authorName)}${gradYear ? ` <span class="text-gray-400 font-normal">· Class of ${gradYear}</span>` : ''}</p>
              ${authorTitle ? `<p class="text-xs text-gray-500">${escapeHtml(authorTitle)}</p>` : ''}
            </div>
          </div>
        </div>
      </div>
    </article>`;
}

/**
 * Wire the story submission form to POST /api/stories.
 * Submission requires being logged in (stories are published under the author's account).
 */
function initStoryForm() {
  const form = document.getElementById('story-submission-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
      if (typeof showNotification === 'function') {
        showNotification('Please log in first to share your story.', 'warning');
      }
      setTimeout(() => { window.location.href = 'portal.html#login'; }, 1200);
      return;
    }

    if (!document.getElementById('story-consent')?.checked) {
      if (typeof showNotification === 'function') {
        showNotification('Please confirm you consent to your story being published.', 'error');
      }
      return;
    }

    const content = document.getElementById('story-content')?.value.trim() || '';
    if (content.split(/\s+/).length < 100) {
      if (typeof showNotification === 'function') {
        showNotification('Your story must be at least 100 words long.', 'error');
      }
      return;
    }

    const payload = {
      title: document.getElementById('story-title')?.value.trim(),
      content,
      achievements: document.getElementById('story-achievements')?.value.trim() || ''
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        if (typeof showNotification === 'function') {
          showNotification(data.message || 'Your story has been published. Thank you for sharing!', 'success');
        }
        form.reset();
        loadStories();
      } else {
        throw new Error(data.error || 'Failed to submit story');
      }
    } catch (error) {
      if (typeof showNotification === 'function') {
        showNotification(error.message, 'error');
      }
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
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
