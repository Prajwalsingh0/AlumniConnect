/**
 * Alumni Profile Logic (V2 - Redesigned)
 */

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    initProfile(userId);
    setupTabs();
    setupNavigationListeners();
});

async function initProfile(userId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'portal.html#login';
            return;
        }

        let endpoint = userId ? `/api/users/public/${userId}` : '/api/users/profile';
        const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Handle expired / invalid token (403 or 401)
        if (response.status === 403 || response.status === 401) {
            // Clear stale session data
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            localStorage.removeItem('user');
            // Redirect to login
            window.location.href = 'portal.html#login';
            return;
        }

        if (!response.ok) throw new Error('Could not load profile');
        const data = await response.json();
        const user = userId ? data.profile : data.user;

        renderHeader(user);
        renderQuickInfo(user);
        renderOverview(user);
        renderExperience(user.profile?.workHistory);
        renderEducation(user.profile?.education);
        renderActivityFeed();
        renderStats(user, token);
        loadProfileReviews(user._id);
        setupSocialMediaLinks(user);

        // Show edit button only for own profile
        if (!userId) {
            const editBtn = document.getElementById('edit-profile-btn');
            if (editBtn) {
                editBtn.style.display = 'flex';
                editBtn.addEventListener('click', () => {
                    window.location.href = 'edit-profile.html';
                });
            }
        }

        // Animate skill bars after slight delay
        setTimeout(animateSkillBars, 400);

    } catch (error) {
        console.error('Profile load error:', error);
        // Show a user-friendly error state
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = 'Unable to load profile';
    }
}

function renderHeader(user) {
    const nameEl = document.getElementById('user-name');
    const titleEl = document.getElementById('user-title');
    const gradEl = document.getElementById('grad-year-badge');

    if (nameEl) nameEl.textContent = user.name || 'Alumni Member';
    if (titleEl) titleEl.textContent = user.profile?.title || 'Professional Alumnus';

    const gradYear = user.profile?.graduationYear;
    if (gradEl && gradYear) {
        gradEl.innerHTML = `<i class="fas fa-graduation-cap"></i><span>Class of ${gradYear}</span>`;
    }

    const imgEl = document.getElementById('profile-img');
    if (imgEl && user.profile?.profileImage) {
        const p = user.profile.profileImage;
        imgEl.src = p.startsWith('http') || p.startsWith('/uploads/') ? p : `/uploads/${p}`;
        imgEl.onerror = () => { imgEl.src = 'images/singlee person.webp'; };
    }

    if (user.profile?.verificationBadge) {
        const badge = document.getElementById('verification-badge');
        if (badge) badge.style.display = 'flex';
    }
}

function renderQuickInfo(user) {
    const fields = [
        { id: 'info-location', rowId: 'info-location-row', value: user.profile?.location },
        { id: 'info-company',  rowId: 'info-company-row',  value: user.profile?.company  },
        { id: 'info-dept',     rowId: 'info-dept-row',     value: user.profile?.department },
        { id: 'info-degree',   rowId: 'info-degree-row',   value: user.profile?.degree   },
    ];

    let anyVisible = false;
    fields.forEach(f => {
        if (f.value) {
            const el = document.getElementById(f.id);
            const row = document.getElementById(f.rowId);
            if (el) el.textContent = f.value;
            if (row) row.style.display = 'flex';
            anyVisible = true;
        }
    });

    const emptyEl = document.getElementById('info-empty');
    if (emptyEl) emptyEl.style.display = anyVisible ? 'none' : 'block';
}

function getMyId() {
    try {
        const raw = localStorage.getItem('userData') || localStorage.getItem('user');
        const user = raw ? JSON.parse(raw) : null;
        return user ? (user._id || user.id) : null;
    } catch {
        return null;
    }
}

function escHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const escAttr = escHtml;

async function toggleEndorsement(button, targetUserId, skillName) {
    if (button.disabled) return;
    const wasEndorsed = button.classList.contains('endorsed');
    button.disabled = true;

    try {
        const response = await fetch(`/api/users/skills/${encodeURIComponent(skillName)}/endorse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ targetUserId })
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            localStorage.removeItem('user');
            window.location.href = 'portal.html#login';
            return;
        }
        if (!response.ok) {
            alert(data.error || 'Could not update the endorsement');
            return;
        }

        const endorsedNow = !wasEndorsed;
        button.classList.toggle('endorsed', endorsedNow);
        button.textContent = endorsedNow ? 'ðŸ‘ Endorsed' : 'ðŸ‘ Endorse';
        const countEl = button.parentElement.querySelector('.endorse-count');
        if (countEl && typeof data.endorsementsCount === 'number') {
            countEl.textContent = `${data.endorsementsCount} endorsement${data.endorsementsCount === 1 ? '' : 's'}`;
        }
    } catch (error) {
        alert('Network error. Please try again.');
    } finally {
        button.disabled = false;
    }
}

async function renderStats(user, token) {
    const connEl = document.getElementById('connection-count');
    if (connEl) countUp(connEl, user.connections?.length || 0);

    const eventEl = document.getElementById('events-count');
    if (eventEl) {
        try {
            const res = await fetch('/api/events', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const now = new Date();
                const upcoming = (data.events || []).filter(e => new Date(e.date) >= now).length;
                countUp(eventEl, upcoming);
            } else {
                eventEl.textContent = '0';
            }
        } catch (e) {
            eventEl.textContent = '0';
        }
    }
}

// Animated number counter
function countUp(el, target) {
    let start = 0;
    const duration = 1000;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
        start += step;
        if (start >= target) {
            el.textContent = target;
            clearInterval(timer);
        } else {
            el.textContent = start;
        }
    }, 16);
}

function renderOverview(user) {
    const bioEl = document.getElementById('user-bio');
    if (bioEl) {
        const bio = user.profile?.bio;
        if (bio) {
            bioEl.textContent = bio;
        } else {
            bioEl.innerHTML = `<span style="opacity:0.5;font-style:italic">No biography yet — this alumnus is busy making waves! ✨</span>`;
        }
    }

    const skillsContainer = document.getElementById('skills-container');
    if (skillsContainer) {
        skillsContainer.innerHTML = '';
        const skills = user.profile?.skills;
        if (skills && skills.length > 0) {
                const myId = getMyId();
                // Endorsements are only offered on other people's profiles
                const canEndorse = !!userId && !!myId && userId !== myId;
                skills.forEach(skill => {
                    const level = (skill.level || 'Intermediate').toLowerCase();
                    const endorsements = Array.isArray(skill.endorsements) ? skill.endorsements : [];
                    const endorsed = canEndorse && endorsements.some(id => String(id) === myId);
                    const count = endorsements.length;
                    const div = document.createElement('div');
                    div.className = 'skill-item';
                    div.innerHTML = `
                        <div class="skill-header">
                            <span class="skill-name">${escHtml(skill.name)}</span>
                            <span class="skill-level-badge level-${level}">${escHtml(skill.level || 'Intermediate')}</span>
                        </div>
                        <div class="skill-bar-track">
                            <div class="skill-bar-fill fill-${level}" data-level="${level}"></div>
                        </div>
                        <div class="skill-endorse-row">
                            ${canEndorse ? `<button type="button" class="endorse-btn${endorsed ? ' endorsed' : ''}" data-skill="${escAttr(skill.name)}">${endorsed ? 'ðŸ‘ Endorsed' : 'ðŸ‘ Endorse'}</button>` : ''}
                            <span class="endorse-count">${count} endorsement${count === 1 ? '' : 's'}</span>
                        </div>
                    `;
                    if (canEndorse) {
                        div.querySelector('.endorse-btn').addEventListener('click', async function () {
                            await toggleEndorsement(this, userId, skill.name);
                        });
                    }
                    skillsContainer.appendChild(div);
                });
        } else {
            skillsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-code"></i>
                    <p>No skills added yet. Edit your profile to add skills!</p>
                </div>`;
        }
    }

    const seekingContainer = document.getElementById('seeking-container');
    if (seekingContainer) {
        seekingContainer.innerHTML = '';
        const seeking = user.profile?.seeking;
        if (seeking && seeking.length > 0) {
            const icons = {
                'Networking': 'fa-users',
                'Mentorship': 'fa-hands-helping',
                'Job Opportunities': 'fa-briefcase',
                'Collaboration': 'fa-handshake',
                'default': 'fa-star'
            };
            seeking.forEach(tag => {
                const icon = icons[tag] || icons['default'];
                const span = document.createElement('span');
                span.className = 'seeking-tag';
                span.innerHTML = `<i class="fas ${icon}" style="font-size:0.7rem"></i>${tag}`;
                seekingContainer.appendChild(span);
            });
        } else {
            seekingContainer.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;font-style:italic">No preferences set.</p>`;
        }
    }
}

function animateSkillBars() {
    document.querySelectorAll('.skill-bar-fill').forEach(bar => {
        // Reset to trigger animation
        const level = bar.getAttribute('data-level');
        bar.style.width = '0';
        setTimeout(() => {
            const widths = { beginner: '30%', intermediate: '60%', expert: '80%', master: '95%' };
            bar.style.width = widths[level] || '60%';
        }, 50);
    });
}

function renderExperience(workHistory) {
    const container = document.getElementById('work-history-container');
    if (!container) return;
    container.innerHTML = '';

    if (!workHistory || workHistory.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-briefcase"></i>
                <p>No work experience listed yet.</p>
            </div>`;
        return;
    }

    workHistory.forEach(job => {
        const startYear = job.startDate ? new Date(job.startDate).getFullYear() : '—';
        const endYear   = job.current ? 'Present' : (job.endDate ? new Date(job.endDate).getFullYear() : '—');

        const item = document.createElement('div');
        item.className = 'exp-item';
        item.innerHTML = `
            <div class="exp-icon"><i class="fas fa-building"></i></div>
            <div class="exp-details">
                <div class="exp-position">${job.position || 'Position'}</div>
                <div class="exp-company">${job.company || 'Company'}</div>
                <div class="exp-date">
                    <i class="far fa-calendar" style="font-size:0.65rem"></i>
                    ${startYear} — ${endYear}
                </div>
                ${job.description ? `<p style="font-size:0.82rem;color:var(--text-muted);margin-top:0.6rem;line-height:1.6">${job.description}</p>` : ''}
            </div>
        `;
        container.appendChild(item);
    });
}

function renderEducation(education) {
    const container = document.getElementById('education-container');
    if (!container) return;
    container.innerHTML = '';

    if (!education || education.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-graduation-cap"></i>
                <p>No education history listed yet.</p>
            </div>`;
        return;
    }

    education.forEach(edu => {
        const item = document.createElement('div');
        item.className = 'edu-item';
        item.innerHTML = `
            <div class="edu-icon"><i class="fas fa-university"></i></div>
            <div>
                <div class="edu-degree">${edu.degree || 'Degree'}</div>
                <div class="edu-institution">${edu.institution || 'Institution'}</div>
                ${edu.fieldOfStudy ? `<div class="edu-field">${edu.fieldOfStudy}</div>` : ''}
                ${edu.graduationYear ? `<div style="margin-top:0.4rem;font-size:0.72rem;color:var(--text-muted)"><i class="fas fa-calendar" style="margin-right:4px"></i>Graduated ${edu.graduationYear}</div>` : ''}
            </div>
        `;
        container.appendChild(item);
    });
}

function renderActivityFeed() {
    const feed = document.getElementById('activity-feed');
    if (!feed) return;

    const activities = [
        { icon: 'fa-user-edit',    bg: '#eef2ff', iconColor: '#4F46E5', text: 'Updated profile information',  time: 'Recently' },
        { icon: 'fa-network-wired', bg: '#f0fdfa', iconColor: '#0d9488', text: 'Joined the Alumni Network',    time: 'Member since account creation' },
    ];

    feed.innerHTML = activities.map(a => `
        <div class="activity-item">
            <div class="activity-dot" style="background:${a.bg}">
                <i class="fas ${a.icon}" style="color:${a.iconColor}"></i>
            </div>
            <div class="activity-text">
                <div class="activity-title">${a.text}</div>
                <div class="activity-time">${a.time}</div>
            </div>
        </div>
    `).join('');
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');

            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');

            const content = document.getElementById(`${target}-tab`);
            if (content) {
                content.classList.add('active');
                // Re-animate skill bars when switching to overview
                if (target === 'overview') setTimeout(animateSkillBars, 100);
            }
        });
    });
}

function setupNavigationListeners() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            localStorage.removeItem('user');
            window.location.href = 'portal.html#login';
        });
    }
}

function setupSocialMediaLinks(user) {
    function applyLink(id, url) {
        const el = document.getElementById(id);
        if (!el) return;
        if (url && url.trim()) {
            el.href = url.startsWith('http') ? url : `https://${url}`;
            el.target = '_blank';
            el.rel = 'noopener noreferrer';
            el.style.opacity = '1';
        } else {
            el.href = '#';
            el.style.opacity = '0.3';
            el.style.cursor = 'default';
            el.addEventListener('click', e => e.preventDefault());
        }
    }

    applyLink('link-linkedin', user.profile?.linkedin);
    applyLink('link-twitter', user.profile?.twitter);
    applyLink('link-github', user.profile?.github);
}

// ── Mentorship reviews section ──────────────────────────────────────────────

async function loadProfileReviews(profileUserId) {
    const container = document.getElementById('reviews-container');
    if (!container || !profileUserId) return;

    container.innerHTML = '<p class="text-sm text-gray-400">Loading reviews…</p>';

    try {
        const response = await fetch(`/api/reviews/user/${encodeURIComponent(profileUserId)}`);
        if (!response.ok) throw new Error('Failed to load reviews');

        const data = await response.json();
        container.innerHTML = '';

        if (!data.count) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = '<i class="fas fa-star"></i>';
            const text = document.createElement('p');
            text.textContent = 'No mentorship reviews yet.';
            empty.appendChild(text);
            container.appendChild(empty);
            return;
        }

        const summary = document.createElement('div');
        summary.className = 'flex items-center gap-3 mb-4';
        const stars = document.createElement('span');
        stars.className = 'text-lg text-amber-500';
        const rounded = Math.round(data.average);
        stars.textContent = '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
        const score = document.createElement('span');
        score.className = 'text-sm text-gray-600';
        score.textContent = `${data.average} out of 5 · ${data.count} review${data.count === 1 ? '' : 's'}`;
        summary.append(stars, score);
        container.appendChild(summary);

        data.reviews.forEach(review => {
            const item = document.createElement('div');
            item.className = 'mb-4 pb-4 border-b border-gray-100 last:border-b-0';

            const header = document.createElement('div');
            header.className = 'flex items-center gap-2 mb-1';
            const avatar = document.createElement('img');
            avatar.src = (review.reviewer && review.reviewer.image) || 'images/singlee person.webp';
            avatar.alt = '';
            avatar.className = 'w-8 h-8 rounded-full object-cover border border-gray-200';
            avatar.onerror = function () { this.onerror = null; this.src = 'images/singlee person.webp'; };

            const who = document.createElement('div');
            const name = document.createElement('p');
            name.className = 'text-sm font-semibold text-gray-900';
            name.textContent = (review.reviewer && review.reviewer.name) || 'Alumni Member';
            const meta = document.createElement('p');
            meta.className = 'text-xs text-amber-500';
            meta.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating) + '  ' +
                new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            who.append(name, meta);
            header.append(avatar, who);
            item.appendChild(header);

            if (review.comment) {
                const comment = document.createElement('p');
                comment.className = 'text-sm text-gray-600 leading-relaxed';
                comment.textContent = review.comment;
                item.appendChild(comment);
            }

            container.appendChild(item);
        });
    } catch (error) {
        container.innerHTML = '<p class="text-sm text-gray-400">Reviews are unavailable right now.</p>';
    }
}
