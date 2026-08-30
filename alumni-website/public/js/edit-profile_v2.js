/**
 * Edit Profile Logic (V2)
 */

// 1. Define addItem function FIRST to ensure availability
function addItem(type, data = {}) {
    const list = type === 'experience' ? document.getElementById('experience-list') : document.getElementById('education-list');
    if (!list) {
        console.error('List container not found for', type);
        return;
    }

    const div = document.createElement('div');
    div.className = 'bg-white border border-gray-200 rounded-xl p-4 relative group hover:border-indigo-200 transition-all hover:shadow-md';

    if (type === 'experience') {
        div.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Company</label>
                    <input type="text" class="form-input bg-white" name="exp_company" placeholder="Company Name" value="${data.company || ''}">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Position</label>
                    <input type="text" class="form-input bg-white" name="exp_position" placeholder="Job Title" value="${data.position || ''}">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 mt-3">
                 <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Start Date</label>
                    <input type="date" class="form-input bg-white text-xs" name="exp_start" value="${data.startDate ? data.startDate.split('T')[0] : ''}">
                 </div>
                 <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">End Date</label>
                    <input type="date" class="form-input bg-white text-xs" name="exp_end" value="${data.endDate ? data.endDate.split('T')[0] : ''}">
                 </div>
            </div>
            <div class="mt-3">
                <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Description</label>
                <textarea class="form-input bg-white" name="exp_desc" placeholder="Responsibilities..." rows="2">${data.description || ''}</textarea>
            </div>
            <button type="button" class="remove-btn absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white text-red-400 border border-gray-200 shadow-sm hover:bg-red-50 hover:text-red-600 transition flex items-center justify-center">
                <i class="fas fa-times text-xs"></i>
            </button>
        `;
    } else {
        div.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Institution</label>
                    <input type="text" class="form-input bg-white" name="edu_institution" placeholder="University/School" value="${data.institution || ''}">
                </div>
                 <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Degree</label>
                    <input type="text" class="form-input bg-white" name="edu_degree" placeholder="Degree" value="${data.degree || ''}">
                </div>
            </div>
             <div class="grid grid-cols-2 gap-4 mt-3">
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Field</label>
                    <input type="text" class="form-input bg-white" name="edu_field" placeholder="Field of Study" value="${data.fieldOfStudy || ''}">
                </div>
                 <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Grad Year</label>
                    <input type="number" class="form-input bg-white" name="edu_year" placeholder="Year" value="${data.graduationYear || ''}">
                </div>
            </div>
            <button type="button" class="remove-btn absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white text-red-400 border border-gray-200 shadow-sm hover:bg-red-50 hover:text-red-600 transition flex items-center justify-center">
                <i class="fas fa-times text-xs"></i>
            </button>
        `;
    }

    // Attach remove listener safely
    const removeBtn = div.querySelector('.remove-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', function () {
            div.remove();
        });
    }

    list.appendChild(div);
}

// Global expose for safety
window.addItem = addItem;

// Add Skill row
function addSkill(data = {}) {
    const list = document.getElementById('skills-list');
    if (!list) return;

    const div = document.createElement('div');
    div.className = 'flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 relative group hover:border-indigo-200 hover:shadow-sm transition-all';

    const levelOptions = ['Beginner', 'Intermediate', 'Expert', 'Master'];
    const selectedLevel = data.level || 'Intermediate';

    div.innerHTML = `
        <div class="flex-1">
            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Skill Name</label>
            <input type="text" name="skill_name" class="form-input bg-white" placeholder="e.g. JavaScript, Project Management" value="${data.name || ''}">
        </div>
        <div class="w-40">
            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Level</label>
            <select name="skill_level" class="form-input bg-white appearance-none">
                ${levelOptions.map(l => `<option value="${l}" ${l === selectedLevel ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
        </div>
        <button type="button" class="remove-btn mt-4 w-7 h-7 rounded-full bg-white text-red-400 border border-gray-200 shadow-sm hover:bg-red-50 hover:text-red-600 transition flex items-center justify-center flex-shrink-0">
            <i class="fas fa-times text-xs"></i>
        </button>
    `;

    div.querySelector('.remove-btn').addEventListener('click', () => div.remove());
    list.appendChild(div);
}

window.addSkill = addSkill;

// 2. Define other helper functions
function setupBioWordCounter() {
    const bioTextarea = document.getElementById('bio-textarea');
    const wordCountSpan = document.getElementById('word-count');
    if (!bioTextarea || !wordCountSpan) return;

    function updateWordCount() {
        const text = bioTextarea.value.trim();
        const words = text === '' ? 0 : text.split(/\s+/).length;
        wordCountSpan.textContent = `${words} / 200 words`;
        if (words > 200) {
            wordCountSpan.classList.add('text-red-500');
            wordCountSpan.classList.remove('text-gray-500');
        } else {
            wordCountSpan.classList.remove('text-red-500');
            wordCountSpan.classList.add('text-gray-500');
        }
    }
    bioTextarea.addEventListener('input', updateWordCount);
    updateWordCount();
}

async function loadCurrentProfile() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch profile');
        const { user } = await response.json();
        const form = document.getElementById('edit-profile-form');

        form.name.value = user.name || '';
        if (form.title) form.title.value = user.profile.title || '';
        if (form.location) form.location.value = user.profile.location || '';
        if (form.graduationYear) form.graduationYear.value = user.profile.graduationYear || '';
        if (form.bio) form.bio.value = user.profile.bio || '';
        if (form.linkedin) form.linkedin.value = user.profile.linkedin || '';
        if (form.twitter) form.twitter.value = user.profile.twitter || '';
        if (form.github) form.github.value = user.profile.github || '';
        const mentorshipToggle = document.getElementById('open-to-mentorship');
        if (mentorshipToggle) mentorshipToggle.checked = !!user.profile.openToMentorship;

        if (user.privacySettings) {
            Object.keys(user.privacySettings).forEach(key => {
                const select = form.querySelector(`[name="privacy_${key}"]`);
                if (select) select.value = user.privacySettings[key];
            });
        }

        if (user.profile.profileImage) {
            const imgPreview = document.getElementById('edit-profile-img');
            if (imgPreview) {
                const path = user.profile.profileImage;
                imgPreview.src = path.startsWith('http') || path.startsWith('/uploads/') ? path : `/uploads/${path}`;
            }
        }

        if (user.profile.workHistory) {
            user.profile.workHistory.forEach(job => addItem('experience', job));
        }
        if (user.profile.education) {
            user.profile.education.forEach(edu => addItem('education', edu));
        }
        // Load existing skills
        if (user.profile.skills && user.profile.skills.length > 0) {
            user.profile.skills.forEach(skill => addSkill(skill));
        }

    } catch (error) {
        console.error('Load Error:', error);
    }
}

async function saveProfile(e) {
    if (e) e.preventDefault();

    const btn = document.getElementById('save-all-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        const form = document.getElementById('edit-profile-form');
        const token = localStorage.getItem('token');
        const payload = {
            name: form.name.value,
            title: form.title ? form.title.value : '',
            location: form.location ? form.location.value : '',
            graduationYear: form.graduationYear ? parseInt(form.graduationYear.value) : null,
            bio: form.bio ? form.bio.value : '',
            linkedin: form.linkedin ? form.linkedin.value : '',
            twitter: form.twitter ? form.twitter.value : '',
            github: form.github ? form.github.value : '',
            openToMentorship: document.getElementById('open-to-mentorship')?.checked || false,
            workHistory: [],
            education: [],
            skills: [],
            privacySettings: {}
        };

        document.querySelectorAll('#experience-list > div').forEach(div => {
            payload.workHistory.push({
                company: div.querySelector('[name="exp_company"]').value,
                position: div.querySelector('[name="exp_position"]').value,
                startDate: div.querySelector('[name="exp_start"]').value,
                endDate: div.querySelector('[name="exp_end"]').value,
                description: div.querySelector('[name="exp_desc"]').value
            });
        });

        document.querySelectorAll('#education-list > div').forEach(div => {
            payload.education.push({
                institution: div.querySelector('[name="edu_institution"]').value,
                degree: div.querySelector('[name="edu_degree"]').value,
                fieldOfStudy: div.querySelector('[name="edu_field"]').value,
                graduationYear: parseInt(div.querySelector('[name="edu_year"]').value)
            });
        });

        // Collect skills
        document.querySelectorAll('#skills-list > div').forEach(div => {
            const name = div.querySelector('[name="skill_name"]').value.trim();
            const level = div.querySelector('[name="skill_level"]').value;
            if (name) payload.skills.push({ name, level });
        });

        form.querySelectorAll('select[name^="privacy_"]').forEach(sel => {
            const key = sel.name.split('_')[1];
            payload.privacySettings[key] = sel.value;
        });

        const response = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || errData.errors?.[0]?.msg || 'Save failed');
        }

        const savedData = await response.json();

        // ✅ Update localStorage so navbar shows updated name immediately
        const storedRaw = localStorage.getItem('userData') || localStorage.getItem('user');
        if (storedRaw) {
            try {
                const stored = JSON.parse(storedRaw);
                if (payload.name) stored.name = payload.name;
                if (savedData.user?.profile?.profileImage) {
                    if (!stored.profile) stored.profile = {};
                    stored.profile.profileImage = savedData.user.profile.profileImage;
                }
                localStorage.setItem('userData', JSON.stringify(stored));
            } catch (e) { /* ignore parse errors */ }
        }

        window.location.href = 'profile.html';

    } catch (error) {
        alert('Error saving profile: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// 3. Initialization Logic
(async function init() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'portal.html#login';
        return;
    }

    // Attach Listeners Immediately
    const addExpBtn = document.getElementById('add-experience-btn');
    if (addExpBtn) {
        addExpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addItem('experience');
        });
    }

    const addEduBtn = document.getElementById('add-education-btn');
    if (addEduBtn) {
        addEduBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addItem('education');
        });
    }

    const addSkillBtn = document.getElementById('add-skill-btn');
    if (addSkillBtn) {
        addSkillBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addSkill();
        });
    }

    const saveBtn = document.getElementById('save-all-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveProfile);

    setupBioWordCounter();
    setupImageUpload();

    // Load Data
    await loadCurrentProfile();
})();

// Image Upload handler
function setupImageUpload() {
    const fileInput = document.getElementById('profile-image-upload');
    const statusText = document.getElementById('upload-status');
    const imgPreview = document.getElementById('edit-profile-img');

    if (!fileInput) return;

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show uploading status
        if (statusText) {
            statusText.textContent = 'Uploading...';
            statusText.classList.remove('hidden', 'text-red-500');
            statusText.classList.add('text-primary-indigo');
        }

        const formData = new FormData();
        formData.append('profileImage', file);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/users/profile/image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to upload image');

            // Update preview using the correct response fields
            const newImageSrc = data.imageUrl || (data.profileImage ? `/uploads/${data.profileImage}` : null);
            if (newImageSrc && imgPreview) {
                imgPreview.src = `${newImageSrc}?t=${new Date().getTime()}`;
                if (statusText) {
                    statusText.textContent = 'Upload successful!';
                    setTimeout(() => statusText.classList.add('hidden'), 3000);
                }
            } else {
                 if (statusText) {
                     statusText.textContent = 'Upload successful! (Please refresh)';
                     setTimeout(() => statusText.classList.add('hidden'), 3000);
                 }
            }
        } catch (err) {
            console.error('Upload Error:', err);
            if (statusText) {
                statusText.textContent = err.message;
                statusText.classList.remove('text-primary-indigo');
                statusText.classList.add('text-red-500');
            }
        }
    });
}
