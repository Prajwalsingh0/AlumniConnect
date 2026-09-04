/**
 * Home data driver - fills the dynamic sections of index.html and about.html
 * from the public GET /api/home endpoint:
 *   #upcoming-events, #featured-alumni, #latest-news  (index.html)
 *   #news-container, #home-spotlight                  (about.html / index.html)
 * Every page degrades gracefully: on failure the existing static fallback
 * content stays visible.
 */

document.addEventListener('DOMContentLoaded', function () {
  loadHomeData();
});

async function loadHomeData() {
  const hasTargets = document.getElementById('upcoming-events')
    || document.getElementById('featured-alumni')
    || document.getElementById('latest-news')
    || document.getElementById('news-container')
    || document.getElementById('home-spotlight');

  if (!hasTargets) return;

  try {
    const response = await fetch('/api/home');
    if (!response.ok) return; // keep static fallbacks

    const data = await response.json();

    if (document.getElementById('upcoming-events')) {
      renderUpcomingEvents(document.getElementById('upcoming-events'), data.upcomingEvents || []);
    }
    if (document.getElementById('featured-alumni')) {
      renderFeaturedAlumni(document.getElementById('featured-alumni'), data.featuredAlumni || []);
    }
    if (document.getElementById('latest-news')) {
      renderLatestNewsPanel(document.getElementById('latest-news'), data.latestStories || []);
    }
    if (document.getElementById('news-container')) {
      renderNewsCards(document.getElementById('news-container'), data.latestStories || []);
    }
    if (document.getElementById('home-spotlight')) {
      renderHomeSpotlight(document.getElementById('home-spotlight'), (data.latestStories || []).slice(0, 2));
    }
  } catch (error) {
    // Network failure: static fallbacks remain visible
  }
}

// ── index.html: Upcoming Events panel ────────────────────────────────────────

function renderUpcomingEvents(container, events) {
  container.innerHTML = '';
  if (events.length === 0) {
    container.innerHTML = '<p class="text-gray-500 italic">No events scheduled yet. Check back soon!</p>';
    return;
  }

  events.forEach(function (event) {
    const item = document.createElement('div');
    item.className = 'border-b border-gray-100 pb-2 mb-2 last:border-b-0';

    const title = document.createElement('p');
    title.className = 'text-sm font-semibold text-gray-800';
    title.textContent = event.title;

    const meta = document.createElement('p');
    meta.className = 'text-xs text-gray-500';
    const when = event.date ? new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const where = [event.venue, event.city].filter(Boolean).join(', ');
    meta.textContent = [when, where].filter(Boolean).join(' · ') || 'Details on the events page';

    item.append(title, meta);
    container.appendChild(item);
  });
}

// ── index.html: Featured Alumni panel ────────────────────────────────────────

function renderFeaturedAlumni(container, alumni) {
  container.innerHTML = '';
  if (alumni.length === 0) {
    container.innerHTML = '<p class="text-gray-500 italic">Be inspired by our successful alumni!</p>';
    return;
  }

  alumni.forEach(function (person) {
    const item = document.createElement('a');
    item.href = 'profile.html?id=' + encodeURIComponent(person.id);
    item.className = 'flex items-center gap-3 group/row hover:bg-indigo-50 rounded-lg p-1 -m-1 transition';

    const image = document.createElement('img');
    image.src = person.image || 'images/singlee person.webp';
    image.alt = 'Profile photo of ' + person.name;
    image.className = 'w-9 h-9 rounded-full object-cover border-2 border-indigo-100 flex-shrink-0';
    image.onerror = function () { this.onerror = null; this.src = 'images/singlee person.webp'; };

    const text = document.createElement('div');
    text.className = 'min-w-0';

    const name = document.createElement('p');
    name.className = 'text-sm font-semibold text-gray-800 truncate';
    name.textContent = person.name;

    const title = document.createElement('p');
    title.className = 'text-xs text-gray-500 truncate';
    title.textContent = [person.title, person.company].filter(Boolean).join(' · ') || 'Alumni Member';

    text.append(name, title);
    item.append(image, text);
    container.appendChild(item);
  });
}

// ── index.html: Latest News panel ────────────────────────────────────────────

function renderLatestNewsPanel(container, stories) {
  container.innerHTML = '';
  if (stories.length === 0) {
    container.innerHTML = '<p class="text-gray-500 italic">Check the news section for updates!</p>';
    return;
  }

  stories.forEach(function (story) {
    const item = document.createElement('a');
    item.href = 'stories.html';
    item.className = 'block border-b border-gray-100 pb-2 mb-2 last:border-b-0 hover:bg-indigo-50 rounded-lg p-1 -m-1 transition';

    const title = document.createElement('p');
    title.className = 'text-sm font-semibold text-gray-800';
    title.textContent = story.title;

    const meta = document.createElement('p');
    meta.className = 'text-xs text-gray-500';
    const when = story.createdAt ? new Date(story.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
    meta.textContent = [story.category, when].filter(Boolean).join(' · ');

    item.append(title, meta);
    container.appendChild(item);
  });
}

// ── about.html: News cards ───────────────────────────────────────────────────

function renderNewsCards(container, stories) {
  container.innerHTML = '';
  if (stories.length === 0) return; // keep the existing static fallback cards

  stories.forEach(function (story) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl shadow-lg overflow-hidden transform hover:shadow-2xl hover:-translate-y-1 transition-all duration-300';

    const image = document.createElement('img');
    image.src = story.image || 'images/newspaper1.png';
    image.alt = story.title;
    image.className = 'w-full h-44 object-cover';
    image.onerror = function () { this.onerror = null; this.src = 'images/newspaper1.png'; };

    const body = document.createElement('div');
    body.className = 'p-6';

    const meta = document.createElement('p');
    meta.className = 'text-xs font-semibold text-accent-teal uppercase tracking-wider mb-2';
    const when = story.createdAt ? new Date(story.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    meta.textContent = [story.category, when].filter(Boolean).join(' · ');

    const title = document.createElement('h3');
    title.className = 'text-xl font-bold text-gray-900 mb-2';
    title.textContent = story.title;

    const excerpt = document.createElement('p');
    excerpt.className = 'text-gray-600 text-sm leading-relaxed mb-4';
    excerpt.textContent = story.excerpt || '';

    const link = document.createElement('a');
    link.href = 'stories.html';
    link.className = 'text-primary-indigo font-semibold text-sm hover:text-accent-teal transition';
    link.textContent = 'Read on Stories page →';

    body.append(meta, title, excerpt, link);
    card.append(image, body);
    container.appendChild(card);
  });
}

// ── index.html: Alumni Spotlight cards ───────────────────────────────────────

function renderHomeSpotlight(container, stories) {
  container.innerHTML = '';
  if (stories.length === 0) return; // keep static fallback

  stories.forEach(function (story, index) {
    const card = document.createElement('div');
    card.className = 'bg-gray-100 rounded-2xl shadow-xl overflow-hidden md:flex md:items-center transform transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl mb-8' + (index % 2 === 1 ? ' md:flex-row-reverse' : '');

    const imageSide = document.createElement('div');
    imageSide.className = 'md:w-1/2 p-6 md:p-8 flex justify-center items-center';
    const image = document.createElement('img');
    image.src = story.image || 'images/image9.jpg';
    image.alt = story.title;
    image.className = 'w-full h-auto object-cover rounded-lg shadow-lg';
    image.onerror = function () { this.onerror = null; this.src = 'images/image9.jpg'; };
    imageSide.appendChild(image);

    const textSide = document.createElement('div');
    textSide.className = 'md:w-1/2 p-6 md:p-8 flex flex-col justify-center';

    const authorName = story.author && story.author.name ? story.author.name : 'Alumni Member';
    const authorImage = story.author && story.author.image ? story.author.image : 'images/singlee person.webp';

    const header = document.createElement('div');
    header.className = 'flex items-center gap-3 mb-3';
    const avatar = document.createElement('img');
    avatar.src = authorImage;
    avatar.alt = '';
    avatar.className = 'w-10 h-10 rounded-full object-cover border-2 border-indigo-100';
    avatar.onerror = function () { this.onerror = null; this.src = 'images/singlee person.webp'; };
    const nameEl = document.createElement('p');
    nameEl.className = 'text-sm font-bold text-gray-900';
    nameEl.textContent = authorName;
    header.append(avatar, nameEl);

    const title = document.createElement('h3');
    title.className = 'text-2xl font-bold text-gray-900 mb-3';
    title.textContent = story.title;

    const quote = document.createElement('p');
    quote.className = 'text-gray-700 leading-relaxed mb-4';
    quote.textContent = '“' + (story.excerpt || '') + '”';

    const link = document.createElement('a');
    link.href = 'stories.html';
    link.className = 'inline-block mt-2 text-accent-teal font-semibold hover:text-primary-indigo transition';
    link.textContent = 'Read on Stories page';

    textSide.append(header, title, quote, link);
    card.append(imageSide, textSide);
    container.appendChild(card);
  });
}
