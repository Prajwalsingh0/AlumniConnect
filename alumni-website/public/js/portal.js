document.addEventListener('DOMContentLoaded', function () {
    const token = localStorage.getItem('token');
    if (token) {
        // Optional: Verify token with backend and get user data
        // For now, just show dashboard if token exists
        window.location.href = 'profile.html';
    } else {
        initPortalFormToggle();
        initPasswordToggle();
    }

    // Initialize logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});



function handleLogout() {
    // Get token before clearing (for API call)
    const token = localStorage.getItem('token');

    // Clear all user session data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    localStorage.removeItem('user');

    // Optional: Call logout API endpoint
    if (token) {
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }).catch(() => {
            // Ignore errors - token is already cleared
        });
    }

    // Show login/register sections and hide dashboard
    const loginSection = document.getElementById('login');
    const registerSection = document.getElementById('register');
    const dashboardSection = document.getElementById('dashboard');
    const tabsSection = document.querySelector('.py-8.bg-white');

    if (loginSection) loginSection.classList.remove('hidden');
    if (registerSection) registerSection.classList.remove('hidden');
    if (tabsSection) tabsSection.classList.remove('hidden');
    if (dashboardSection) dashboardSection.classList.add('hidden');

    // Reset to login tab
    if (document.getElementById('login')) {
        document.getElementById('login').classList.remove('hidden');
    }
    if (document.getElementById('register')) {
        document.getElementById('register').classList.add('hidden');
    }
    const loginTab = document.querySelector('[data-tab="login"]');
    const registerTab = document.querySelector('[data-tab="register"]');
    if (loginTab) loginTab.classList.add('active');
    if (registerTab) registerTab.classList.remove('active');

    // Reload the page to ensure clean state
    window.location.hash = 'login';
    setTimeout(() => {
        window.location.reload();
    }, 100);
}

function initPortalFormToggle() {
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginSection = document.getElementById('login');
    const registerSection = document.getElementById('register');
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');

    function showLogin() {
        if (loginSection && registerSection) {
            loginSection.classList.remove('hidden');
            registerSection.classList.add('hidden');
        }
        if (loginTab && registerTab) {
            loginTab.classList.add('bg-blue-600', 'text-white');
            loginTab.classList.remove('text-gray-600');
            registerTab.classList.remove('bg-blue-600', 'text-white');
            registerTab.classList.add('text-gray-600');
        }
    }

    function showRegister() {
        if (loginSection && registerSection) {
            loginSection.classList.add('hidden');
            registerSection.classList.remove('hidden');
        }
        if (loginTab && registerTab) {
            registerTab.classList.add('bg-blue-600', 'text-white');
            registerTab.classList.remove('text-gray-600');
            loginTab.classList.remove('bg-blue-600', 'text-white');
            loginTab.classList.add('text-gray-600');
        }
    }

    if (loginTab) loginTab.addEventListener('click', showLogin);
    if (registerTab) registerTab.addEventListener('click', showRegister);
    if (switchToRegister) switchToRegister.addEventListener('click', showRegister);
    if (switchToLogin) switchToLogin.addEventListener('click', showLogin);

    const hash = window.location.hash;
    if (hash === '#register') {
        showRegister();
    } else if (hash === '#login') {
        showLogin();
    }
}

function initPasswordToggle() {
    const passwordToggles = [
        'toggle-login-password',
        'toggle-reg-password',
        'toggle-confirm-password'
    ];

    passwordToggles.forEach(toggleId => {
        const toggle = document.getElementById(toggleId);
        if (toggle) {
            toggle.addEventListener('click', function () {
                const input = toggle.parentElement.querySelector('input');
                const icon = toggle.querySelector('i');

                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    input.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        }
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.status === 403 && data.code === 'EMAIL_NOT_VERIFIED') {
            showNotification(data.error, 'error');
            offerResendVerification(email);
            return;
        }

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));

        showNotification('Login successful! Welcome back.', 'success');

        setTimeout(() => {
            window.location.href = 'profile.html';
        }, 1000);

    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/**
 * Offers a resend of the verification email when login is blocked by the
 * email-verification gate. Renders a small inline form under the login form.
 */
function offerResendVerification(email) {
    const loginForm = document.getElementById('login-form');
    if (!loginForm || document.getElementById('resend-verification-box')) return;

    const box = document.createElement('div');
    box.id = 'resend-verification-box';
    box.className = 'mt-4 p-4 rounded-lg bg-blue-50 border border-blue-100 text-sm';
    const safeEmail = email.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    box.innerHTML = `
        <p class="text-gray-700 mb-2">Need a new verification link?</p>
        <div class="flex gap-2">
            <input type="email" id="resend-email" value="${safeEmail}" required
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-indigo focus:border-primary-indigo" />
            <button type="button" id="resend-verification-btn"
                class="bg-primary-indigo text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-primary-dark-blue transition">Resend</button>
        </div>
        <p id="resend-result" class="text-xs mt-2 text-gray-500"></p>
    `;
    loginForm.after(box);

    box.querySelector('#resend-verification-btn').addEventListener('click', async function () {
        const btn = this;
        const result = box.querySelector('#resend-result');
        btn.disabled = true;
        btn.textContent = 'Sending…';
        try {
            const response = await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: box.querySelector('#resend-email').value.trim() })
            });
            const data = await response.json().catch(() => ({}));
            result.textContent = data.message || 'If that email needs verification, a new link has been sent.';
            result.className = 'text-xs mt-2 text-gray-500';
        } catch (error) {
            result.textContent = 'Network error. Please try again.';
            result.className = 'text-xs mt-2 text-gray-500';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Resend';
        }
    });
}

async function handleRegistration(e) {
    e.preventDefault();

    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    if (password !== confirmPassword) {
        showNotification('Passwords do not match!', 'error');
        return;
    }

    const userData = {
        firstName: document.getElementById('reg-first-name').value,
        lastName: document.getElementById('reg-last-name').value,
        email: document.getElementById('reg-email').value,
        phone: document.getElementById('reg-phone').value,
        graduationYear: document.getElementById('reg-graduation-year').value,
        degree: document.getElementById('reg-degree').value,
        major: document.getElementById('reg-major').value,
        password: password
    };

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.errors ? data.errors.map(err => err.msg).join(', ') : (data.error || 'Registration failed');
            throw new Error(errorMessage);
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));

        showNotification('Registration successful! Welcome to the alumni network.', 'success');

        setTimeout(() => {
            window.location.href = 'profile.html';
        }, 1000);

    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm transform transition-all duration-300 translate-x-full`;

    switch (type) {
        case 'success':
            notification.classList.add('bg-green-600', 'text-white');
            break;
        case 'error':
            notification.classList.add('bg-red-600', 'text-white');
            break;
        case 'warning':
            notification.classList.add('bg-yellow-600', 'text-white');
            break;
        default:
            notification.classList.add('bg-blue-600', 'text-white');
    }

    notification.innerHTML = `
        <div class="flex items-center justify-between">
            <span>${message}</span>
            <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);

    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

const registrationForm = document.getElementById('registration-form');
if (registrationForm) {
    registrationForm.addEventListener('submit', handleRegistration);
}