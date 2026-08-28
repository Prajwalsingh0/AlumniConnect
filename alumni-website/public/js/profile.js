/**
 * Alumni Profile & Dashboard Logic (Overwritten Fix)
 */
console.log("PROFILE ORIGINAL FIX LOADED");

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    initProfile(userId);
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
            // Redirect to login with a message hint in the hash
            window.location.href = 'portal.html#login';
            return;
        }

        if (!response.ok) throw new Error('Could not load profile');
        const data = await response.json();
        const user = userId ? data.profile : data.user;

        renderHeader(user, !userId);
        renderOverview(user);
        renderExperience(user.profile.workHistory);
        renderEducation(user.profile.education);

        renderStats(user, token);
        renderActivityFeed();

        if (!userId) {
            document.getElementById('edit-profile-btn').classList.remove('hidden');
            document.getElementById('edit-profile-btn').addEventListener('click', () => {
                window.location.href = 'edit-profile.html';
            });
            calculateCompletion(user);
        } else {
            const completionCard = document.getElementById('profile-completion-card');
            if (completionCard) completionCard.classList.add('hidden');
        }

    } catch (error) {
        console.error('Init Error:', error);
        // Show a user-friendly error state instead of staying on blank loading screen
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = 'Unable to load profile';
        const bioEl = document.getElementById('user-bio');
        if (bioEl) bioEl.textContent = 'There was an error loading your profile. Please refresh or log in again.';
    }
}

function renderHeader(user, isOwnProfile) {
    const nameEl = document.getElementById('user-name');
    const titleEl = document.getElementById('user-title');
    const gradEl = document.getElementById('grad-year-badge');

    if (nameEl) nameEl.textContent = user.name;
    if (titleEl) titleEl.textContent = user.profile.title || 'Professional Alumnus';

    const gradYear = user.profile.graduationYear;
    if (gradEl && gradYear) {
        gradEl.textContent = `Class of ${gradYear}`;
    }

    if (user.profile.profileImage) {
        const imgEl = document.getElementById('profile-img');
        if (imgEl) imgEl.src = user.profile.profileImage.startsWith('http') ? user.profile.profileImage : `/uploads/${user.profile.profileImage}`;
    }

    if (user.profile.verificationBadge) {
        const vBadge = document.getElementById('verification-badge');
        if (vBadge) vBadge.classList.remove('hidden');
    }
}

async function renderStats(user, token) {
    const connEl = document.getElementById('connection-count');
    if (connEl) connEl.textContent = user.connections?.length || '0';

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
                eventEl.textContent = upcoming;
            } else {
                eventEl.textContent = '0';
            }
        } catch (e) {
            eventEl.textContent = '5';
        }
    }
}

function renderOverview(user) {
    const bioText = user.profile.bio || "No biography provided yet. This alumnus is busy making waves in the professional world!";
    const bioEl = document.getElementById('user-bio');
    if (bioEl) {
        bioEl.textContent = bioText;
        if (user.profile.bio) bioEl.classList.remove('italic');
    }

    const skillsContainer = document.getElementById('skills-container');
    if (skillsContainer) {
        skillsContainer.innerHTML = '';
        if (user.profile.skills && user.profile.skills.length > 0) {
            user.profile.skills.forEach(skill => {
                const skillEl = document.createElement('div');
                skillEl.className = 'bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center';
                skillEl.innerHTML = `
                    <div>
                        <p class="font-bold text-sm text-gray-900">${skill.name}</p>
                        <span class="text-[10px] text-gray-500 uppercase font-bold">${skill.level || 'Intermediate'}</span>
                    </div>
                `;
                skillsContainer.appendChild(skillEl);
            });
        }
    }

    const seekingContainer = document.getElementById('seeking-container');
    if (seekingContainer) {
        seekingContainer.innerHTML = '';
        if (user.profile.seeking && user.profile.seeking.length > 0) {
            user.profile.seeking.forEach(tag => {
                const badge = document.createElement('span');
                badge.className = 'px-3 py-1 bg-indigo-50 text-primary-indigo text-[11px] font-bold rounded-full border border-indigo-100 uppercase tracking-wider';
                badge.textContent = tag;
                seekingContainer.appendChild(badge);
            });
        }
    }
}

function renderExperience(workHistory) {
    const container = document.getElementById('work-history-container');
    if (!container) return;
    container.innerHTML = '';

    if (!workHistory || workHistory.length === 0) {
        container.innerHTML = '<p class="text-gray-400 italic text-sm">No work experience listed yet.</p>';
        return;
    }

    workHistory.forEach(job => {
        const item = document.createElement('div');
        item.className = 'flex gap-4 p-4 rounded-xl border border-gray-100 bg-white';
        const start = new Date(job.startDate).getFullYear();
        const end = job.current ? 'Present' : new Date(job.endDate).getFullYear();

        item.innerHTML = `
            <div class="flex-1">
                <h4 class="font-bold text-gray-900">${job.position}</h4>
                <p class="text-primary-indigo text-sm font-semibold">${job.company}</p>
                <span class="text-[10px] font-bold text-gray-400 uppercase bg-gray-50 px-2 py-1 rounded">${start} — ${end}</span>
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
        container.innerHTML = '<p class="text-gray-400 italic text-sm">No education history listed yet.</p>';
        return;
    }

    education.forEach(edu => {
        const item = document.createElement('div');
        item.className = 'p-5 rounded-xl border border-gray-100 bg-gray-50 border-l-4 border-l-primary-indigo';
        item.innerHTML = `
            <div>
                <h4 class="font-bold text-gray-900">${edu.degree}</h4>
                <p class="text-sm font-semibold text-gray-600">${edu.institution}</p>
                <p class="text-[10px] text-gray-400 uppercase tracking-widest mt-1">${edu.fieldOfStudy}</p>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderActivityFeed() {
    const activityFeed = document.getElementById('activity-feed');
    if (!activityFeed) return;
    activityFeed.innerHTML = '<p>Activity feed loaded.</p>';
}

function calculateCompletion(user) {
    let score = 50;
    const textEl = document.getElementById('completion-text');
    const fillEl = document.getElementById('completion-fill');
    if (textEl) textEl.textContent = `${score}%`;
    if (fillEl) fillEl.style.width = `${score}%`;
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    document.getElementById(`${tabId}-tab`)?.classList.remove('hidden');
}

function setupNavigationListeners() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = 'portal.html#login';
        });
    }
}
