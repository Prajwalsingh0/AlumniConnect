/**
 * Groups - Page Logic
 * Consumes the existing /api/groups + /api/groups/:id/posts endpoints:
 * browse (public), search, join (auth), create (auth), and per-group
 * discussion feeds with posting (members only). Safe rendering via
 * textContent/DOM APIs throughout.
 */

const groupsState = {
  groups: [],
  myId: null,
  activeGroupId: null,
  posts: []
};

document.addEventListener('DOMContentLoaded', function () {
  groupsState.myId = resolveMyId();
  bindListEvents();
  bindDetailEvents();
  bindCreateForm();

  const params = new URLSearchParams(window.location.search);
  const groupId = params.get('id');

  loadGroups().then(function () {
    if (groupId) openGroup(groupId);
  });
});

function resolveMyId() {
  try {
    const raw = localStorage.getItem('userData') || localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    return user ? (user._id || user.id) : null;
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem('token');
}

function isLoggedIn() {
  return !!getToken();
}

function clearSessionAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('userData');
  localStorage.removeItem('user');
  window.location.href = 'portal.html#login';
}

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await response.json(); } catch { /* non-JSON */ }
  return { status: response.status, data };
}

// ── List view ────────────────────────────────────────────────────────────────

function bindListEvents() {
  document.getElementById('retry-load').addEventListener('click', loadGroups);
  document.getElementById('group-search').addEventListener('input', renderLists);
  document.getElementById('create-form').addEventListener('submit', createGroup);
}

async function loadGroups() {
  const grid = document.getElementById('groups-grid');
  const loading = document.getElementById('list-loading');
  const errorBox = document.getElementById('list-error');

  grid.innerHTML = '';
  loading.classList.remove('hidden');
  errorBox.classList.add('hidden');

  try {
    const response = await fetch('/api/groups');
    if (!response.ok) throw new Error('Failed to load groups');

    groupsState.groups = await response.json();

    loading.classList.add('hidden');
    renderLists();
  } catch (error) {
    loading.classList.add('hidden');
    grid.innerHTML = '';
    errorBox.classList.remove('hidden');
  }
}

function isMemberOf(group) {
  if (!groupsState.myId) return false;
  return (group.members || []).some(function (m) {
    return String(m.user) === groupsState.myId;
  });
}

function renderLists() {
  const mySection = document.getElementById('my-groups-section');
  const myGrid = document.getElementById('my-groups-grid');
  const grid = document.getElementById('groups-grid');
  const query = document.getElementById('group-search').value.trim().toLowerCase();

  const mine = groupsState.groups.filter(isMemberOf);
  const mineIds = new Set(mine.map(function (g) { return g._id; }));

  const browse = groupsState.groups.filter(function (g) { return !mineIds.has(g._id); });

  // My groups (only for logged-in users with memberships)
  if (isLoggedIn() && mine.length > 0) {
    mySection.classList.remove('hidden');
    myGrid.innerHTML = '';
    mine.forEach(function (group) {
      if (matchesSearch(group, query)) myGrid.appendChild(renderGroupCard(group, true));
    });
    if (myGrid.children.length === 0) {
      mySection.classList.add('hidden');
    }
  } else {
    mySection.classList.add('hidden');
  }

  // Browse grid
  grid.innerHTML = '';
  const visibleBrowse = browse.filter(function (g) { return matchesSearch(g, query); });
  if (visibleBrowse.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'col-span-full text-center py-12 bg-white rounded-2xl shadow';
    const icon = document.createElement('i');
    icon.className = 'fas fa-users text-4xl text-gray-200 mb-4';
    const text = document.createElement('p');
    text.className = 'text-gray-400';
    text.textContent = query
      ? 'No groups match your search.'
      : 'No groups yet — create the first one below!';
    empty.append(icon, text);
    grid.appendChild(empty);
    return;
  }
  visibleBrowse.forEach(function (group) {
    grid.appendChild(renderGroupCard(group, false));
  });
}

function matchesSearch(group, query) {
  if (!query) return true;
  return (group.name || '').toLowerCase().includes(query)
    || (group.description || '').toLowerCase().includes(query)
    || (group.category || '').toLowerCase().includes(query);
}

function renderGroupCard(group, isMine) {
  const card = document.createElement('div');
  card.className = 'bg-white rounded-2xl shadow-lg p-6 flex flex-col transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-1';

  const header = document.createElement('div');
  header.className = 'flex items-start justify-between mb-3';

  const nameEl = document.createElement('h3');
  nameEl.className = 'text-lg font-bold text-gray-900';
  nameEl.textContent = group.name;

  const badge = document.createElement('span');
  badge.className = 'text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full';
  badge.textContent = categoryLabel(group.category);

  header.append(nameEl, badge);

  if (group.isPrivate) {
    const lock = document.createElement('span');
    lock.className = 'text-[11px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full';
    lock.innerHTML = '<i class="fas fa-lock mr-1" aria-hidden="true"></i>Private';
    lock.title = 'Private groups are not listed publicly';
    header.appendChild(lock);
  }
  card.appendChild(header);

  const description = document.createElement('p');
  description.className = 'text-sm text-gray-600 leading-relaxed mb-4 flex-1';
  description.textContent = group.description || 'No description yet.';
  card.appendChild(description);

  const meta = document.createElement('div');
  meta.className = 'flex items-center gap-4 text-xs text-gray-500 mb-4';
  const members = document.createElement('span');
  members.innerHTML = '<i class="fas fa-user-group mr-1" aria-hidden="true"></i>' + (group.members || []).length + ' member' + ((group.members || []).length === 1 ? '' : 's');
  const created = document.createElement('span');
  created.innerHTML = '<i class="far fa-calendar mr-1" aria-hidden="true"></i>' + new Date(group.createdAt || Date.now()).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  meta.append(members, created);
  card.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'mt-auto';

  const member = isMemberOf(group);

  if (member) {
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'w-full bg-primary-indigo text-white py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark-blue transition';
    open.textContent = 'Open group';
    open.addEventListener('click', function () { openGroup(group._id); });
    actions.appendChild(open);
  } else if (isLoggedIn()) {
    const join = document.createElement('button');
    join.type = 'button';
    join.className = 'w-full bg-accent-teal text-white py-2 rounded-lg text-sm font-semibold hover:bg-teal-600 transition';
    join.textContent = 'Join group';
    join.addEventListener('click', function () { joinGroup(group._id, join); });
    actions.appendChild(join);
  } else {
    const view = document.createElement('button');
    view.type = 'button';
    view.className = 'w-full bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition';
    view.textContent = 'View details';
    view.addEventListener('click', function () { openGroup(group._id); });
    actions.appendChild(view);
  }

  card.appendChild(actions);
  return card;
}

function categoryLabel(category) {
  return category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Group';
}

// ── Join / Create ────────────────────────────────────────────────────────────

async function joinGroup(groupId, button) {
  if (!isLoggedIn()) {
    window.location.href = 'portal.html#login';
    return;
  }

  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Joining…';

  try {
    const result = await api('POST', `/api/groups/${encodeURIComponent(groupId)}/join`);
    if (result.status === 401 || result.status === 403) { clearSessionAndRedirect(); return; }
    if (!result.ok) throw new Error((result.data && result.data.error) || 'Could not join the group');

    const group = groupsState.groups.find(function (g) { return g._id === groupId; });
    if (group) group.members.push({ user: groupsState.myId });
    renderLists();
  } catch (error) {
    button.disabled = false;
    button.textContent = original;
    alert(error.message);
  }
}

async function createGroup(e) {
  e.preventDefault();

  if (!isLoggedIn()) {
    window.location.href = 'portal.html#login';
    return;
  }

  const errorEl = document.getElementById('create-error');
  const button = document.getElementById('create-submit');
  errorEl.classList.add('hidden');

  const privateToggle = document.getElementById('group-private');

  const payload = {
    name: document.getElementById('group-name').value.trim(),
    category: document.getElementById('group-category').value,
    description: document.getElementById('group-description').value.trim(),
    isPrivate: !!(privateToggle && privateToggle.checked)
  };

  if (!payload.name) {
    errorEl.textContent = 'Please give the group a name.';
    errorEl.classList.remove('hidden');
    return;
  }

  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1" aria-hidden="true"></i>Creating…';

  try {
    const result = await api('POST', '/api/groups', payload);

    if (result.status === 401 || result.status === 403) { clearSessionAndRedirect(); return; }
    if (result.status === 400 || result.status === 409) {
      errorEl.textContent = (result.data && result.data.error) || 'Could not create the group (the name may already be taken).';
      errorEl.classList.remove('hidden');
    } else if (result.status === 201) {
      groupsState.groups.push(result.data);
      groupsState.groups.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      document.getElementById('create-form').reset();
      renderLists();
      showCreateSuccess(result.data.name);
    } else {
      errorEl.textContent = 'Could not create the group. Please try again.';
      errorEl.classList.remove('hidden');
    }
  } catch (error) {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.classList.remove('hidden');
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-plus mr-1" aria-hidden="true"></i>Create group';
  }
}

function showCreateSuccess(name) {
  const banner = document.createElement('div');
  banner.className = 'mb-6 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2';
  banner.innerHTML = '<i class="fas fa-circle-check" aria-hidden="true"></i>';
  banner.appendChild(document.createTextNode(`Group "${name}" created. It is now open below.`));
  const browse = document.getElementById('browse-section');
  browse.insertBefore(banner, browse.firstElementChild);
  setTimeout(function () { banner.remove(); }, 4000);
}

// ── Detail view (?id=...) ────────────────────────────────────────────────────

function bindDetailEvents() {
  document.getElementById('back-to-groups').addEventListener('click', function () {
    closeGroup();
  });
  document.getElementById('post-form').addEventListener('submit', submitPost);
}

function closeGroup() {
  setActiveGroupId(null);
  document.getElementById('detail-view').classList.add('hidden');
  document.getElementById('list-view').classList.remove('hidden');
  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, document.title, 'groups.html');
  }
}

function setActiveGroupId(id) {
  groupsState.activeGroupId = id;
}

async function openGroup(groupId) {
  const group = groupsState.groups.find(function (g) { return g._id === groupId; });
  if (!group) return;

  setActiveGroupId(groupId);
  groupsState.posts = [];

  document.getElementById('list-view').classList.add('hidden');
  document.getElementById('detail-view').classList.remove('hidden');
  renderGroupHeader(group);

  const postsSection = document.getElementById('posts-section');
  postsSection.classList.remove('hidden');
  const list = document.getElementById('posts-list');
  list.innerHTML = '<p class="text-center text-gray-400 text-sm py-6">Loading discussions…</p>';
  renderComposer(group);

  try {
    const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/posts`, {
      headers: isLoggedIn() ? { 'Authorization': `Bearer ${getToken()}` } : {}
    });
    if (!response.ok) throw new Error('Failed');
    groupsState.posts = await response.json();
    renderPosts();
  } catch (error) {
    list.innerHTML = '<p class="text-center text-red-400 text-sm py-6">Could not load discussions.</p>';
  }

  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, document.title, 'groups.html?id=' + encodeURIComponent(groupId));
  }
}

function renderGroupHeader(group) {
  const header = document.getElementById('group-header');
  header.innerHTML = '';

  const top = document.createElement('div');
  top.className = 'flex flex-wrap items-start justify-between gap-4';

  const info = document.createElement('div');
  info.className = 'min-w-0';

  const badge = document.createElement('span');
  badge.className = 'text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full';
  badge.textContent = categoryLabel(group.category);

  const name = document.createElement('h2');
  name.className = 'text-3xl font-bold text-gray-900 mt-2 mb-2';
  name.textContent = group.name;

  const description = document.createElement('p');
  description.className = 'text-gray-600';
  description.textContent = group.description || 'No description yet.';

  info.append(badge, name, description);
  top.appendChild(info);

  const side = document.createElement('div');
  side.className = 'text-right';

  const members = document.createElement('p');
  members.className = 'text-sm text-gray-600 mb-1';
  members.innerHTML = '<i class="fas fa-user-group mr-1" aria-hidden="true"></i>' + (group.members || []).length + ' member' + ((group.members || []).length === 1 ? '' : 's');

  const since = document.createElement('p');
  since.className = 'text-xs text-gray-400';
  since.innerHTML = '<i class="far fa-calendar mr-1" aria-hidden="true"></i>Since ' + new Date(group.createdAt || Date.now()).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  side.append(members, since);
  top.appendChild(side);

  header.appendChild(top);

  if (isLoggedIn() && isMemberOf(group)) {
    const controls = document.createElement('div');
    controls.className = 'mt-5 flex flex-wrap gap-3';

    if (isManagerOf(group)) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-100 transition';
      edit.innerHTML = '<i class="fas fa-pen mr-1" aria-hidden="true"></i>Edit details';
      edit.addEventListener('click', function () { openGroupEditModal(group._id); });
      controls.appendChild(edit);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'bg-white border border-red-200 text-red-600 px-5 py-2.5 rounded-lg font-semibold hover:bg-red-50 transition';
      remove.innerHTML = '<i class="fas fa-trash-can mr-1" aria-hidden="true"></i>Delete group';
      remove.addEventListener('click', function () { deleteGroup(group._id); });
      controls.appendChild(remove);
    } else {
      const leave = document.createElement('button');
      leave.type = 'button';
      leave.className = 'bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-100 transition';
      leave.innerHTML = '<i class="fas fa-right-from-bracket mr-1" aria-hidden="true"></i>Leave group';
      leave.addEventListener('click', function () { leaveGroup(group._id); });
      controls.appendChild(leave);
    }

    header.appendChild(controls);
  }

  const member = isMemberOf(group);
  if (!member && isLoggedIn()) {
    const joinWrap = document.createElement('div');
    joinWrap.className = 'mt-5';
    const join = document.createElement('button');
    join.type = 'button';
    join.className = 'bg-accent-teal text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-teal-600 transition';
    join.innerHTML = '<i class="fas fa-user-plus mr-1" aria-hidden="true"></i>Join this group';
    join.addEventListener('click', async function () {
      join.disabled = true;
      try {
        const result = await api('POST', `/api/groups/${encodeURIComponent(group._id)}/join`);
        if (result.status === 401 || result.status === 403) { clearSessionAndRedirect(); return; }
        if (!result.ok) throw new Error((result.data && result.data.error) || 'Could not join');
        group.members.push({ user: groupsState.myId });
        renderGroupHeader(group);
        renderComposer(group);
        renderLists();
      } catch (error) {
        join.disabled = false;
        alert(error.message);
      }
    });
    joinWrap.appendChild(join);
    header.appendChild(joinWrap);
  }
}

function renderComposer(group) {
  const composer = document.getElementById('post-composer');
  const member = isMemberOf(group);

  if (!isLoggedIn()) {
    composer.innerHTML = '<p class="text-sm text-gray-500 text-center py-3">Log in and join this group to start a discussion. <a href="portal.html#login" class="text-primary-indigo font-semibold">Log in</a></p>';
    return;
  }
  if (!member) {
    composer.innerHTML = '<p class="text-sm text-gray-500 text-center py-3">Join this group to start a discussion.</p>';
    return;
  }
  composer.innerHTML = `
    <h3 class="text-lg font-bold text-gray-900 mb-3">Start a discussion</h3>
    <div id="post-form-error" class="hidden mb-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm" role="alert"></div>
    <form id="post-form">
      <input type="text" id="post-title" placeholder="Discussion title" required maxlength="150"
        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-indigo focus:border-primary-indigo transition" />
      <textarea id="post-content" rows="4" required placeholder="Share something with the group…"
        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-indigo focus:border-primary-indigo transition"></textarea>
      <div class="flex justify-end">
        <button type="submit" id="post-submit"
          class="bg-primary-indigo text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark-blue disabled:opacity-50 disabled:cursor-not-allowed transition">
          <i class="fas fa-paper-plane mr-1" aria-hidden="true"></i>Post
        </button>
      </div>
    </form>`;

  document.getElementById('post-form').addEventListener('submit', submitPost);
}

async function submitPost(e) {
  e.preventDefault();

  const groupId = groupsState.activeGroupId;
  const group = groupsState.groups.find(function (g) { return g._id === groupId; });
  if (!group) return;
  if (!isLoggedIn()) { clearSessionAndRedirect(); return; }

  const title = document.getElementById('post-title').value.trim();
  const content = document.getElementById('post-content').value.trim();
  const errorEl = document.getElementById('post-form-error');
  const button = document.getElementById('post-submit');

  errorEl.classList.add('hidden');
  if (!title) { errorEl.textContent = 'Please add a title.'; errorEl.classList.remove('hidden'); return; }
  if (!content) { errorEl.textContent = 'Please write something before posting.'; errorEl.classList.remove('hidden'); return; }

  button.disabled = true;

  try {
    const result = await api('POST', `/api/groups/${encodeURIComponent(groupId)}/posts`, { title, content });

    if (result.status === 401 || result.status === 403) { clearSessionAndRedirect(); return; }
    if (result.status === 403) {
      errorEl.textContent = result.data.error || 'Only members can post.';
      errorEl.classList.remove('hidden');
      button.disabled = false;
      return;
    }
    if (result.status !== 201) {
      errorEl.textContent = (result.data && result.data.error) || 'Could not create the post.';
      errorEl.classList.remove('hidden');
      button.disabled = false;
      return;
    }

    const post = result.data;
    post.author = { _id: resolveMyId(), name: myName(), profile: { profileImage: null } };
    groupsState.posts.unshift(post);
    renderPosts();

    document.getElementById('post-title').value = '';
    document.getElementById('post-content').value = '';
    button.disabled = false;
  } catch (error) {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.classList.remove('hidden');
    button.disabled = false;
  }
}

function myName() {
  try {
    const raw = localStorage.getItem('userData') || localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    return user ? (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'You') : 'You';
  } catch {
    return 'You';
  }
}

function renderPosts() {
  const list = document.getElementById('posts-list');
  list.innerHTML = '';

  if (groupsState.posts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-center py-12 bg-white rounded-2xl shadow';
    const icon = document.createElement('i');
    icon.className = 'far fa-comment-dots text-4xl text-gray-200 mb-4';
    const text = document.createElement('p');
    text.className = 'text-gray-400';
    text.textContent = 'No discussions yet. Start the first one!';
    empty.append(icon, text);
    list.appendChild(empty);
    return;
  }

  groupsState.posts.forEach(function (post) {
    const card = document.createElement('article');
    card.className = 'bg-white rounded-2xl shadow-lg p-5 md:p-6';

    const head = document.createElement('div');
    head.className = 'flex items-center gap-3 mb-3';

    const image = document.createElement('img');
    image.src = (post.author && post.author.profile && post.author.profile.profileImage) || 'images/singlee person.webp';
    image.alt = '';
    image.className = 'w-10 h-10 rounded-full object-cover border-2 border-indigo-100';
    image.onerror = function () { this.onerror = null; this.src = 'images/singlee person.webp'; };

    const who = document.createElement('div');
    const author = document.createElement('p');
    author.className = 'font-semibold text-gray-900 text-sm';
    author.textContent = (post.author && post.author.name) || 'Alumni Member';
    const when = document.createElement('p');
    when.className = 'text-xs text-gray-400';
    when.innerHTML = (post.isPinned ? '<i class="fas fa-thumbtack text-accent-teal mr-1" aria-hidden="true"></i>' : '') +
      new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    who.append(author, when);

    head.append(image, who);

    if (post.isPinned) {
      const pinned = document.createElement('span');
      pinned.className = 'ml-auto text-[10px] font-bold uppercase tracking-wide text-accent-teal bg-teal-50 px-2 py-0.5 rounded-full';
      pinned.textContent = 'Pinned';
      head.appendChild(pinned);
    }

    const title = document.createElement('h4');
    title.className = 'text-lg font-bold text-gray-900 mb-2';
    title.textContent = post.title;

    const content = document.createElement('p');
    content.className = 'text-gray-700 text-sm leading-relaxed whitespace-pre-wrap';
    content.textContent = post.content;

    card.append(head, title, content);

    const group = activeGroup();
    const myId = resolveMyId();
    const mine = !!(post.author && (post.author._id === myId || post.author === myId));
    const manager = !!group && isManagerOf(group);

    if (isLoggedIn() && (mine || manager)) {
      const actions = document.createElement('div');
      actions.className = 'flex gap-3 mt-4 pt-3 border-t border-gray-100';

      if (manager) {
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'text-xs font-semibold text-gray-500 hover:text-primary-indigo transition';
        pin.innerHTML = '<i class="fas fa-thumbtack mr-1" aria-hidden="true"></i>' + (post.isPinned ? 'Unpin' : 'Pin');
        pin.addEventListener('click', function () { togglePin(post._id, !post.isPinned); });
        actions.appendChild(pin);
      }

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'text-xs font-semibold text-red-500 hover:text-red-700 transition';
      remove.innerHTML = '<i class="fas fa-trash-can mr-1" aria-hidden="true"></i>Delete';
      remove.addEventListener('click', function () { deletePost(post._id); });
      actions.appendChild(remove);

      card.appendChild(actions);
    }

    list.appendChild(card);
  });
}

// ── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------- Group ownership helpers ----------

function isManagerOf(group) {
  if (!group) return false;
  const me = resolveMyId();
  if (!me) return false;
  if (group.createdBy === me) return true;
  const entry = (group.members || []).find(function (m) {
    return (m.user === me || (m.user && m.user._id === me));
  });
  return !!entry && entry.role === 'admin';
}

function activeGroup() {
  return groupsState.groups.find(function (g) { return g._id === groupsState.activeGroupId; }) || null;
}

async function reloadPosts() {
  const groupId = groupsState.activeGroupId;
  if (!groupId) return;

  try {
    const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/posts`, {
      headers: isLoggedIn() ? { 'Authorization': `Bearer ${getToken()}` } : {}
    });
    if (!response.ok) throw new Error('Failed');
    groupsState.posts = await response.json();
    renderPosts();
  } catch (error) {
    // Leave the current list in place on failure
  }
}

async function leaveGroup(groupId) {
  if (!window.confirm('Leave this group?')) return;

  const result = await api('POST', `/api/groups/${encodeURIComponent(groupId)}/leave`);
  if (result.status === 401) { clearSessionAndRedirect(); return; }

  if (result.status !== 200) {
    alert((result.data && result.data.error) || 'Could not leave the group.');
    return;
  }

  showToast((result.data && result.data.message) || 'Left the group');
  await loadGroups();
  closeGroup();
}

async function deleteGroup(groupId) {
  const group = groupsState.groups.find(function (g) { return g._id === groupId; });
  const name = (group && group.name) || 'this group';
  if (!window.confirm('Delete ' + name + '? Its discussions are removed too. This cannot be undone.')) return;

  const result = await api('DELETE', `/api/groups/${encodeURIComponent(groupId)}`);
  if (result.status === 401) { clearSessionAndRedirect(); return; }

  if (result.status !== 200) {
    alert((result.data && result.data.error) || 'Could not delete the group.');
    return;
  }

  showToast('Group deleted');
  await loadGroups();
  closeGroup();
}

async function deletePost(postId) {
  if (!window.confirm('Delete this post?')) return;

  const groupId = groupsState.activeGroupId;
  const result = await api('DELETE', `/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}`);
  if (result.status === 401) { clearSessionAndRedirect(); return; }

  if (result.status !== 200) {
    alert((result.data && result.data.error) || 'Could not delete the post.');
    return;
  }

  groupsState.posts = groupsState.posts.filter(function (p) { return p._id !== postId; });
  renderPosts();
  showToast('Post deleted');
}

async function togglePin(postId, pinned) {
  const groupId = groupsState.activeGroupId;
  const result = await api('PATCH', `/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/pin`, { isPinned: pinned });
  if (result.status === 401) { clearSessionAndRedirect(); return; }

  if (result.status !== 200) {
    alert((result.data && result.data.error) || 'Could not update the post.');
    return;
  }

  await reloadPosts();
}

function openGroupEditModal(groupId) {
  if (document.getElementById('group-edit-overlay')) return;

  const group = groupsState.groups.find(function (g) { return g._id === groupId; });
  if (!group) return;

  const overlay = document.createElement('div');
  overlay.id = 'group-edit-overlay';
  overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-900">Edit group details</h3>
        <button type="button" id="group-edit-close" class="w-8 h-8 rounded-full hover:bg-gray-100 transition" aria-label="Close">
          <i class="fas fa-times text-gray-500"></i>
        </button>
      </div>
      <div class="p-6">
        <label for="group-edit-name" class="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
        <input type="text" id="group-edit-name" maxlength="80"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-indigo focus:border-primary-indigo transition">

        <label for="group-edit-description" class="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
        <textarea id="group-edit-description" rows="3" maxlength="500"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-indigo focus:border-primary-indigo transition"></textarea>

        <label for="group-edit-category" class="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
        <select id="group-edit-category"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-indigo focus:border-primary-indigo transition">
          <option value="department">Department</option>
          <option value="industry">Industry</option>
          <option value="hobby">Hobby</option>
          <option value="location">Location</option>
          <option value="other">Other</option>
        </select>

        <label class="flex items-start justify-between gap-4 cursor-pointer">
          <span>
            <span class="block text-sm font-semibold text-gray-900">Private group</span>
            <span class="block text-xs text-gray-500">Not listed publicly. Members join through a direct link.</span>
          </span>
          <input type="checkbox" id="group-edit-private" class="mt-1 h-5 w-5 rounded border-gray-300 text-primary-indigo focus:ring-primary-indigo">
        </label>

        <div id="group-edit-error" class="hidden mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm" role="alert"></div>

        <div class="flex justify-end gap-3 mt-5">
          <button type="button" id="group-edit-cancel" class="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">Cancel</button>
          <button type="button" id="group-edit-save" class="bg-primary-indigo text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark-blue disabled:opacity-50 transition">Save changes</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#group-edit-name').value = group.name || '';
  overlay.querySelector('#group-edit-description').value = group.description || '';
  overlay.querySelector('#group-edit-category').value = group.category || 'other';
  overlay.querySelector('#group-edit-private').checked = !!group.isPrivate;

  const errorEl = overlay.querySelector('#group-edit-error');
  const saveBtn = overlay.querySelector('#group-edit-save');

  function close() { overlay.remove(); }
  overlay.querySelector('#group-edit-close').addEventListener('click', close);
  overlay.querySelector('#group-edit-cancel').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

  saveBtn.addEventListener('click', async function () {
    errorEl.classList.add('hidden');
    saveBtn.disabled = true;

    const payload = {
      name: overlay.querySelector('#group-edit-name').value.trim(),
      description: overlay.querySelector('#group-edit-description').value.trim(),
      category: overlay.querySelector('#group-edit-category').value,
      isPrivate: overlay.querySelector('#group-edit-private').checked
    };

    try {
      const result = await api('PATCH', `/api/groups/${encodeURIComponent(groupId)}`, payload);

      if (result.status === 401) { clearSessionAndRedirect(); return; }

      if (result.status !== 200) {
        errorEl.textContent = (result.data && result.data.error) || 'Could not save the changes.';
        errorEl.classList.remove('hidden');
        return;
      }

      const index = groupsState.groups.findIndex(function (g) { return g._id === groupId; });
      if (index !== -1) groupsState.groups[index] = result.data;

      close();
      renderGroupHeader(result.data);
      renderLists();
      showToast('Group updated');
    } catch (error) {
      errorEl.textContent = 'Network error. Please try again.';
      errorEl.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
    }
  });
}