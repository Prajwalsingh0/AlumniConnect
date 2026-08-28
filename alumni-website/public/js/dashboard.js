// Dashboard JavaScript - User Profile and Activity Management

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

// ==============================================
// DASHBOARD INITIALIZATION
// ==============================================

async function initializeDashboard() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'portal.html';
        return;
    }

    await fetchUserProfile(token);
    loadDashboardData();
    setupEventListeners();
    updateDateTime();
    
    // Update date and time every second
    setInterval(updateDateTime, 1000);
    
    // Set current year in footer
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

// ==============================================
// USER DATA MANAGEMENT
// ==============================================

async function fetchUserProfile(token) {
    try {
        const response = await fetch('/api/users/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // If token is invalid or expired, redirect to login
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'portal.html';
            }
            throw new Error('Failed to fetch user profile');
        }

        const data = await response.json();
        const user = data.user;

        // Store user data for other parts of the dashboard
        localStorage.setItem('user', JSON.stringify(user));

        updateUserProfile(user);
        updateUserStats(user);

    } catch (error) {
        console.error('Error fetching user profile:', error);
        // Clear stored data and redirect to login on error
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'portal.html';
    }
}

function updateUserProfile(user) {
    // Extract profile data - handle both nested and flat structures
    const profile = user.profile || {};
    const name = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
    const email = user.email || '';
    const phone = profile.phone || user.phone || 'Not provided';
    const location = profile.location || user.location || 'Not provided';
    const title = profile.title || user.title || user.currentPosition || 'Not provided';
    const graduationYear = profile.graduationYear || user.graduationYear;
    const batch = graduationYear ? `Class of ${graduationYear}` : 'Not provided';
    
    // Update all profile elements
    const profileElements = {
        'user-name': name,
        'dashboard-user-name': name,
        'profile-name': name,
        'profile-email': email,
        'profile-phone': phone,
        'profile-location': location,
        'profile-title': title,
        'profile-batch': batch
    };

    Object.keys(profileElements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = profileElements[id];
        }
    });

    // Update avatar
    const avatarElements = document.querySelectorAll('#user-avatar, #profile-avatar, #modal-profile-avatar');
    avatarElements.forEach(avatar => {
        const path = user.profileImage || profile.profileImage;
        if (path) {
            avatar.src = path.startsWith('http') || path.startsWith('/uploads/') ? path : `/uploads/${path}`;
        } else {
            avatar.src = 'images/singlee person.webp'; // Default avatar
        }
    });
}

async function updateUserStats(user) {
    try {
        // Fetch real data from API
        const token = localStorage.getItem('token');
        
        // Fetch events count
        const eventsResponse = await fetch('/api/events', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        let eventsCount = 0;
        if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            const now = new Date();
            eventsCount = eventsData.events?.filter(event => {
                const eventDate = new Date(event.date);
                return eventDate >= now;
            }).length || 0;
        }
        
        const statsElements = {
            'connections-count': user.connections?.length || 0,
            'events-count': eventsCount,
            'news-count': 0  // Can be updated when news API is available
        };

        Object.keys(statsElements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = statsElements[id];
            }
        });
    } catch (error) {
        console.error('Error updating stats:', error);
        // Fallback to default values
        const statsElements = {
            'connections-count': 0,
            'events-count': 0,
            'news-count': 0
        };
        Object.keys(statsElements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = statsElements[id];
            }
        });
    }
}

// ==============================================
// DASHBOARD DATA LOADING (with mock data for now)
// ==============================================

function loadDashboardData() {
    loadActivityFeed();
    loadUpcomingEvents();
    // Job-related functionality removed as per request
}

function loadActivityFeed() {
    const activities = [
        {
            type: 'connection',
            icon: 'fas fa-user-friends text-blue-500',
            message: 'You connected with Sarah Johnson',
            time: '2 hours ago'
        },
        {
            type: 'event',
            icon: 'fas fa-calendar-check text-green-500',
            message: 'Registered for Alumni Networking Event',
            time: '1 day ago'
        },
        {
            type: 'story',
            icon: 'fas fa-share-alt text-orange-500',
            message: 'Posted an article on AI trends',
            time: '2 days ago'
        },
        {
            type: 'story',
            icon: 'fas fa-share-alt text-orange-500',
            message: 'Shared your success story',
            time: '3 days ago'
        },
        {
            type: 'milestone',
            icon: 'fas fa-trophy text-yellow-500',
            message: 'Reached 100+ connections milestone!',
            time: '1 week ago'
        }
    ];

    const activityFeed = document.getElementById('activity-feed');
    if (activityFeed) {
        activityFeed.innerHTML = activities.map(activity => `
            <div class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition duration-200">
                <div class="flex-shrink-0">
                    <div class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <i class="${activity.icon}"></i>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-900">${activity.message}</p>
                    <p class="text-xs text-gray-500 mt-1">${activity.time}</p>
                </div>
            </div>
        `).join('');
    }
}

async function loadUpcomingEvents() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/events', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        let events = [];
        if (response.ok) {
            const data = await response.json();
            const now = new Date();
            events = (data.events || []).filter(event => {
                const eventDate = new Date(event.date);
                return eventDate >= now;
            }).slice(0, 5); // Show only next 5 events
        }

        // If no events from API, show empty state
        if (events.length === 0) {
            events = [{
                title: 'No upcoming events',
                date: '',
                time: '',
                location: 'Check back soon for new events!',
                type: 'Info',
                isEmpty: true
            }];
        }

        const eventsContainer = document.getElementById('upcoming-events');
        if (eventsContainer) {
            eventsContainer.innerHTML = events.map(event => {
                if (event.isEmpty) {
                    return `
                        <div class="border border-gray-200 rounded-lg p-6 text-center">
                            <i class="fas fa-calendar-times text-gray-400 text-4xl mb-3"></i>
                            <p class="text-gray-600">${event.location}</p>
                            <a href="events.html" class="mt-4 inline-block text-primary-indigo hover:text-indigo-700 text-sm font-medium">
                                Browse All Events →
                            </a>
                        </div>
                    `;
                }
                
                const eventDate = new Date(event.date);
                const formattedDate = eventDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
                const time = event.time || 'TBA';
                
                return `
                    <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition duration-300">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <h4 class="font-semibold text-gray-900 mb-1">${event.title}</h4>
                                <div class="text-sm text-gray-600 space-y-1">
                                    <div class="flex items-center">
                                        <i class="fas fa-calendar text-gray-400 mr-2"></i>
                                        <span>${formattedDate}</span>
                                    </div>
                                    ${time !== 'TBA' ? `
                                    <div class="flex items-center">
                                        <i class="fas fa-clock text-gray-400 mr-2"></i>
                                        <span>${time}</span>
                                    </div>
                                    ` : ''}
                                    <div class="flex items-center">
                                        <i class="fas fa-map-marker-alt text-gray-400 mr-2"></i>
                                        <span>${event.location || 'TBA'}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="ml-4">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    ${event.category || event.type || 'Event'}
                                </span>
                            </div>
                        </div>
                        <div class="mt-3 flex space-x-2">
                            <a href="events.html" class="flex-1 bg-primary-indigo text-white px-3 py-2 rounded-md text-sm hover:bg-indigo-700 transition duration-300 text-center">
                                View Details
                            </a>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading events:', error);
        const eventsContainer = document.getElementById('upcoming-events');
        if (eventsContainer) {
            eventsContainer.innerHTML = `
                <div class="border border-gray-200 rounded-lg p-6 text-center">
                    <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-3"></i>
                    <p class="text-gray-600">Unable to load events. Please try again later.</p>
                </div>
            `;
        }
    }
}

// Job-related functionality removed as per request

// ==============================================
// EVENT LISTENERS
// ==============================================

function setupEventListeners() {
    // Logout buttons (prevent duplicate listeners)
    const logoutBtns = document.querySelectorAll('#logout-btn, #mobile-logout-btn, #dropdown-logout');
    logoutBtns.forEach(btn => {
        if (btn && !btn.hasAttribute('data-logout-listener')) {
            btn.setAttribute('data-logout-listener', 'true');
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLogout();
            });
        }
    });

    // Quick action buttons - now they're links, so no need for click handlers
    // They'll navigate naturally

    // Edit profile button
    const editProfileBtn = document.querySelector('button:has(.fa-edit)');
    const modal = document.getElementById('edit-profile-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const editProfileForm = document.getElementById('edit-profile-form');

    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            const user = getCurrentUser();
            if (user && modal) {
                openEditProfileModal(user);
            }
        });
    }

    if(closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }

    if(cancelEditBtn && modal) {
        cancelEditBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }

    if (editProfileForm) {
        editProfileForm.addEventListener('submit', handleProfileUpdate);
    }

    // Image preview for modal
    const profileImageUpload = document.getElementById('profile-image-upload');
    if (profileImageUpload) {
        profileImageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const modalAvatar = document.getElementById('modal-profile-avatar');
                    if (modalAvatar) {
                        modalAvatar.src = event.target.result;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }
}

function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            return JSON.parse(userStr);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function openEditProfileModal(user) {
    const modal = document.getElementById('edit-profile-modal');
    if (!modal) return;
    
    // Populate form fields
    const profile = user.profile || {};
    const name = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
    
    const editName = document.getElementById('edit-name');
    const editTitle = document.getElementById('edit-title');
    const editPhone = document.getElementById('edit-phone');
    const editLocation = document.getElementById('edit-location');
    const editGradYear = document.getElementById('edit-graduation-year');
    
    if (editName) editName.value = name;
    if (editTitle) editTitle.value = profile.title || user.title || '';
    if (editPhone) editPhone.value = profile.phone || user.phone || '';
    if (editLocation) editLocation.value = profile.location || user.location || '';
    if (editGradYear) editGradYear.value = profile.graduationYear || user.graduationYear || '';
    
    // Show modal
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('.transform').classList.remove('scale-95', 'opacity-0');
        modal.querySelector('.transform').classList.add('scale-100', 'opacity-100');
    }, 10);
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Please log in to update your profile', 'error');
        return;
    }
    
    const formData = new FormData(e.target);
    const profileData = {
        name: formData.get('name'),
        title: formData.get('title'),
        phone: formData.get('phone'),
        location: formData.get('location'),
        graduationYear: formData.get('graduationYear')
    };
    
    try {
        const response = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profileData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to update profile');
        }
        
        const data = await response.json();
        showNotification('Profile updated successfully!', 'success');
        
        // Update local storage
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Refresh profile display
        updateUserProfile(data.user);
        
        // Close modal
        const modal = document.getElementById('edit-profile-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Failed to update profile. Please try again.', 'error');
    }
}

function handleLogout() {
    // Get token before clearing (for API call)
    const token = localStorage.getItem('token');
    
    // Clear all user session data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    localStorage.removeItem('user');
    
    // Optional: Call logout API endpoint (for server-side tracking)
    // Note: Token is cleared above, so this might fail - that's okay
    if (token) {
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }).catch(err => {
            // Ignore errors - token is already cleared
            console.log('Logout API call completed');
        });
    }
    
    // Show logout message if notification function exists
    if (typeof showNotification === 'function') {
        showNotification('You have been logged out successfully.', 'success');
    }
    
    // Redirect to portal/login page
    setTimeout(() => {
        window.location.href = 'portal.html#login';
    }, 500);
}

function handleQuickAction(e) {
    const action = e.target.textContent.trim();
    
    switch(action) {
        case 'Connect with Alumni':
            showNotification('Opening alumni directory...', 'info');
            break;
        case 'Register for Events':
            window.location.href = 'events.html';
            break;
        case 'Browse Jobs':
            // Job-related functionality removed as per request
            break;
        case 'Share Your Story':
            window.location.href = 'stories.html#submit';
            break;
    }
}

function handleEventRegistration(e) {
    const eventCard = e.target.closest('.border');
    const eventTitle = eventCard.querySelector('h4').textContent;
    
    showNotification(`Registered for "${eventTitle}" successfully!`, 'success');
    
    // Update event count
    const eventsCount = document.getElementById('events-count');
    if (eventsCount) {
        eventsCount.textContent = parseInt(eventsCount.textContent) - 1;
    }
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

function updateDateTime() {
    const now = new Date();
    
    // Update date
    const dateElement = document.getElementById('dashboard-date');
    if (dateElement) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = now.toLocaleDateString('en-US', options);
    }
    
    // Update time
    const timeElement = document.getElementById('dashboard-time');
    if (timeElement) {
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
        timeElement.textContent = now.toLocaleTimeString('en-US', timeOptions);
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
    
    // Set colors based on type
    const colors = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        info: 'bg-blue-500 text-white',
        warning: 'bg-yellow-500 text-black'
    };
    
    notification.className += ` ${colors[type] || colors.info}`;
    notification.innerHTML = `
        <div class="flex items-center">
            <span class="mr-2">${message}</span>
            <button class="ml-2 text-lg font-bold" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// ==============================================
// MOCK AUTHENTICATION (REMOVED)
// ==============================================