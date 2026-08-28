/**
 * Events Page - Dynamic Content Loader
 * Fetches events from /api/events and populates the event registration dropdown
 */

document.addEventListener('DOMContentLoaded', function () {
    // Initialize form first so it can replace the DOM node safely
    initEventRegistrationForm();
    // Fetch and populate events after the modal's DOM structure is finalized
    loadEventsForDropdown();
});

/**
 * Fetch events from the API and populate the "Select Event" dropdown
 * in the registration form with upcoming events.
 */
async function loadEventsForDropdown() {
    const eventSelect = document.getElementById('event-select');
    if (!eventSelect) return;

    try {
        const response = await fetch('/api/events');
        if (!response.ok) throw new Error('Failed to fetch events');

        const data = await response.json();
        const allEvents = data.events || [];

        // Filter only upcoming events (date >= today and not marked completed)
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const upcomingEvents = allEvents.filter(e => new Date(e.date) >= now && e.status !== 'completed');

        // Clear existing placeholder options (keep the first empty one)
        const firstOption = eventSelect.querySelector('option[value=""]');
        eventSelect.innerHTML = '';
        if (firstOption) eventSelect.appendChild(firstOption);

        if (upcomingEvents.length === 0) {
            const noEventsOption = document.createElement('option');
            noEventsOption.value = '';
            noEventsOption.textContent = 'No upcoming events at the moment';
            noEventsOption.disabled = true;
            eventSelect.appendChild(noEventsOption);
            return;
        }

        // Populate dropdown with upcoming events
        upcomingEvents.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;

            // Format date nicely
            const eventDate = new Date(event.date);
            const formatted = eventDate.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });

            option.textContent = `${event.title} — ${formatted}`;
            eventSelect.appendChild(option);
        });

        // ── Render on Page if Grids Exist ──
        renderEventsToPage(allEvents);

    } catch (error) {
        console.warn('Could not load events from API:', error.message);
        // Leave existing static options as-is so the form still works
    }
}

function renderEventsToPage(events) {
    const upcomingGrid = document.getElementById('upcoming-events-grid');
    const pastGrid = document.getElementById('past-events-grid');

    if (!upcomingGrid && !pastGrid) return; // We aren't on the events page

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming = events.filter(e => new Date(e.date) >= now && e.status !== 'completed');
    const past = events.filter(e => new Date(e.date) < now || e.status === 'completed');

    if (upcomingGrid) {
        upcomingGrid.innerHTML = '';
        if (upcoming.length === 0) {
            upcomingGrid.innerHTML = `<p class="text-gray-500 col-span-full text-center">No upcoming events currently scheduled. Check back soon!</p>`;
        } else {
            upcoming.forEach(ev => {
                upcomingGrid.innerHTML += createEventCardHtml(ev, false);
            });
        }
    }

    if (pastGrid) {
        pastGrid.innerHTML = '';
        if (past.length === 0) {
            pastGrid.innerHTML = `<p class="text-gray-500 col-span-full text-center">No past events recorded yet.</p>`;
        } else {
            past.forEach(ev => {
                pastGrid.innerHTML += createEventCardHtml(ev, true);
            });
        }
    }
}

function createEventCardHtml(ev, isPast) {
    const defaultImg = "images/event.png";
    const coverImage = (ev.images && ev.images.length > 0) ? ev.images[0] : defaultImg;
    
    // Safety check for location structure
    let locationStr = ev.location;
    if (typeof ev.location === 'object') {
       locationStr = [ev.location.venue, ev.location.city].filter(Boolean).join(', ');
    }
    locationStr = locationStr || "Online / TBD";

    const dateStr = new Date(ev.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const badge = isPast 
      ? `<span class="absolute top-3 left-3 bg-gray-700 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">✅ Completed</span>`
      : ``;
      
    const cta = isPast
      ? `<span class="inline-block bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-full mt-4">Event Concluded</span>`
      : `<span class="mt-4 inline-block text-blue-600 font-medium hover:text-blue-500 transition duration-300">Register Now &rarr;</span>`;
      
    const anchorHref = isPast ? `#` : `#registration`;

    return `
      <a href="${anchorHref}" class="block bg-white rounded-2xl shadow-lg overflow-hidden transform transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:-translate-y-2 animate-fadeIn mb-8 relative">
        <div class="relative">
          <img src="${coverImage}" alt="${ev.title}" class="w-full h-48 object-cover" onerror="this.src='${defaultImg}'" />
          ${badge}
        </div>
        <div class="p-6">
          <h3 class="text-xl font-semibold text-gray-900 mb-2">${ev.title}</h3>
          <p class="text-gray-600 mb-4 line-clamp-3 text-sm leading-relaxed">${ev.description}</p>
          <p class="text-sm text-gray-500 mb-1">📅 <strong>Date:</strong> ${dateStr} | 📍 ${locationStr}</p>
          ${isPast && ev.attendees ? `<p class="text-sm text-gray-500 mb-4">👥 <strong>Attendees:</strong> ${ev.attendees.length}</p>` : ''}
          ${cta}
        </div>
      </a>
    `;
}

/**
 * Handle the event registration form submission.
 * Tries to send to API if user is logged in; otherwise shows a success notification.
 */
function initEventRegistrationForm() {
    const form = document.getElementById('event-registration-form');
    if (!form) return;

    // Remove any existing listener added by script.js to avoid double submission
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const eventId = document.getElementById('event-select')?.value;
        const firstName = document.getElementById('first-name')?.value?.trim();
        const lastName = document.getElementById('last-name')?.value?.trim();
        const email = document.getElementById('email')?.value?.trim();

        if (!eventId || !firstName || !lastName || !email) {
            showEventsNotification('Please fill in all required fields.', 'error');
            return;
        }

        const token = localStorage.getItem('token');

        if (token && eventId) {
            try {
                const response = await fetch(`/api/events/${eventId}/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ firstName, lastName, email })
                });

                const data = await response.json();

                if (response.ok) {
                    showEventsNotification('🎉 Successfully registered for the event!', 'success');
                    newForm.reset();
                } else if (response.status === 400 && data.error === 'Already registered for this event') {
                    showEventsNotification('You are already registered for this event.', 'warning');
                } else if (response.status === 400 && data.error === 'Cannot register for past events') {
                    showEventsNotification('This event has already passed. Please select an upcoming event.', 'warning');
                } else if (response.status === 403 || response.status === 401) {
                    // Token expired — clear and prompt re-login
                    localStorage.removeItem('token');
                    localStorage.removeItem('userData');
                    showEventsNotification('Your session has expired. Please log in again to register.', 'warning');
                } else {
                    throw new Error(data.error || 'Registration failed');
                }
            } catch (err) {
                showEventsNotification(err.message || 'Something went wrong. Please try again.', 'error');
            }
        } else {
            // Not logged in — still show a success message (graceful degradation)
            showEventsNotification('Registration submitted! Please log in to confirm your spot.', 'success');
            newForm.reset();
        }
    });
}

/**
 * Simple notification helper for the events page.
 */
function showEventsNotification(message, type = 'info') {
    // Use global showNotification if available (from script.js)
    if (typeof showNotification === 'function') {
        showNotification(message, type);
        return;
    }

    const colors = {
        success: '#16a34a',
        error: '#dc2626',
        warning: '#d97706',
        info: '#2563eb'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 1rem; right: 1rem; z-index: 9999;
        background: ${colors[type] || colors.info}; color: white;
        padding: 1rem 1.25rem; border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        max-width: 20rem; font-size: 0.9rem;
        transform: translateX(120%); transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => { notification.style.transform = 'translateX(0)'; }, 50);
    setTimeout(() => {
        notification.style.transform = 'translateX(120%)';
        setTimeout(() => notification.remove(), 350);
    }, 5000);
}
