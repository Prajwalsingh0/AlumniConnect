/**
 * Edit Profile Logic
 * Handles dynamic form building and data persistence
 */

const experienceList = document.getElementById('experience-list');
const educationList = document.getElementById('education-list');

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'portal.html#login';
        return;
    }

    await loadCurrentProfile();

    document.getElementById('save-all-btn').addEventListener('click', saveProfile);
});

async function loadCurrentProfile() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch profile');
        const { user } = await response.json();

        // Populate basic fields
        const form = document.getElementById('edit-profile-form');
        form.name.value = user.name || '';
        form.title.value = user.profile.title || '';
        form.location.value = user.profile.location || '';
        form.graduationYear.value = user.profile.graduationYear || '';
        form.bio.value = user.profile.bio || '';

        // Populate privacy
        if (user.privacySettings) {
            Object.keys(user.privacySettings).forEach(key => {
                const select = form.querySelector(`[name="privacy_${key}"]`);
                if (select) select.value = user.privacySettings[key];
            });
        }

        // Populate lists
        if (user.profile.workHistory) {
            user.profile.workHistory.forEach(job => addItem('experience', job));
        }
        if (user.profile.education) {
            user.profile.education.forEach(edu => addItem('education', edu));
        }

    } catch (error) {
        console.error('Load Error:', error);
    }
}

function addItem(type, data = {}) {
    const container = type === 'experience' ? experienceList : educationList;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'glass p-6 relative group border-white/5 bg-white/5 rounded-2xl';

    if (type === 'experience') {
        itemDiv.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" class="form-input" name="exp_company" placeholder="Company Name" value="${data.company || ''}">
                <input type="text" class="form-input" name="exp_position" placeholder="Job Title" value="${data.position || ''}">
                <input type="date" class="form-input text-xs" name="exp_start" value="${data.startDate ? data.startDate.split('T')[0] : ''}">
                <input type="date" class="form-input text-xs" name="exp_end" value="${data.endDate ? data.endDate.split('T')[0] : ''}">
            </div>
            <textarea class="form-input mt-4" name="exp_desc" placeholder="Responsibilities..." rows="2">${data.description || ''}</textarea>
            <button type="button" onclick="this.parentElement.remove()" class="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition flex items-center justify-center border border-red-500/30">
                <i class="fas fa-times text-xs"></i>
            </button>
        `;
    } else {
        itemDiv.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" class="form-input" name="edu_institution" placeholder="Institution" value="${data.institution || ''}">
                <input type="text" class="form-input" name="edu_degree" placeholder="Degree (e.g. B.Sc.)" value="${data.degree || ''}">
                <input type="text" class="form-input" name="edu_field" placeholder="Field of Study" value="${data.fieldOfStudy || ''}">
                <input type="number" class="form-input" name="edu_year" placeholder="Graduation Year" value="${data.graduationYear || ''}">
            </div>
            <button type="button" onclick="this.parentElement.remove()" class="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition flex items-center justify-center border border-red-500/30">
                <i class="fas fa-times text-xs"></i>
            </button>
        `;
    }
    container.appendChild(itemDiv);
}

async function saveProfile() {
    const btn = document.getElementById('save-all-btn');
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        const form = document.getElementById('edit-profile-form');
        const token = localStorage.getItem('token');

        const payload = {
            name: form.name.value,
            title: form.title.value,
            location: form.location.value,
            graduationYear: parseInt(form.graduationYear.value),
            bio: form.bio.value,
            workHistory: [],
            education: [],
            privacySettings: {}
        };

        // Gather Experience
        document.querySelectorAll('#experience-list > div').forEach(div => {
            payload.workHistory.push({
                company: div.querySelector('[name="exp_company"]').value,
                position: div.querySelector('[name="exp_position"]').value,
                startDate: div.querySelector('[name="exp_start"]').value,
                endDate: div.querySelector('[name="exp_end"]').value,
                description: div.querySelector('[name="exp_desc"]').value
            });
        });

        // Gather Education
        document.querySelectorAll('#education-list > div').forEach(div => {
            payload.education.push({
                institution: div.querySelector('[name="edu_institution"]').value,
                degree: div.querySelector('[name="edu_degree"]').value,
                fieldOfStudy: div.querySelector('[name="edu_field"]').value,
                graduationYear: parseInt(div.querySelector('[name="edu_year"]').value)
            });
        });

        // Gather Privacy
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

        if (!response.ok) throw new Error('Save failed');

        alert('Profile updated successfully!');
        window.location.href = 'profile.html';

    } catch (error) {
        alert('Error saving: ' + error.message);
    } finally {
        btn.textContent = 'Save All Changes';
        btn.disabled = false;
    }
}
