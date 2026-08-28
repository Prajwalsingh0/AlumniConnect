/**
 * admin-auth.js
 * Admin Authentication Guard
 * Include this script at the TOP of admin.html (before page content renders)
 * It verifies JWT token + admin role via /api/auth/me
 */

const ADMIN_LOGIN_PAGE = 'admin-login.html';
const API_BASE = '/api';

async function checkAdminAccess() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  // No token → go to login
  if (!token) {
    redirectToLogin('no_token');
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      redirectToLogin('invalid_token');
      return null;
    }

    const data = await res.json();
    const user = data.user;

    // Must have role === 'admin'
    if (!user || user.role !== 'admin') {
      redirectToLogin('not_admin');
      return null;
    }

    return user; // return user data for the page to use
  } catch (err) {
    console.error('Admin auth check failed:', err);
    redirectToLogin('network_error');
    return null;
  }
}

function redirectToLogin(reason) {
  const url = `${ADMIN_LOGIN_PAGE}?reason=${reason}&redirect=${encodeURIComponent(window.location.pathname)}`;
  window.location.replace(url);
}

function adminLogout() {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
  redirectToLogin('logout');
}
