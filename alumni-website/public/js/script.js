// Alumni Website - Main JavaScript File
// Shared logic used on every page: mobile navigation, user dropdown,
// login state in the navbar, logout, notifications, smooth scrolling.
//
// Page-specific forms are handled by their own scripts:
//   portal.html  -> js/portal.js   (login / registration)
//   events.html  -> js/events.js   (event registration)
//   stories.html -> js/stories.js  (story submission)
//   profile.html -> js/profile_v2.js, edit-profile.html -> js/edit-profile_v2.js

document.addEventListener("DOMContentLoaded", function () {
  initMobileNavigation();
  initUserDropdownToggle();
  loadUserStatus();
});

// ==============================================
// NAVIGATION FUNCTIONALITY
// ==============================================

function initMobileNavigation() {
  const mobileMenuButton = document.getElementById("mobile-menu-button");
  const mobileMenu = document.getElementById("mobile-menu");

  // Only proceed if both elements exist
  if (!mobileMenuButton || !mobileMenu) {
    return;
  }

  mobileMenuButton.addEventListener("click", function () {
    const isHidden = mobileMenu.classList.contains("hidden");

    if (isHidden) {
      mobileMenu.classList.remove("hidden");
      mobileMenuButton.innerHTML = '<i class="fas fa-times text-xl"></i>';
      document.body.classList.add("overflow-hidden");
    } else {
      mobileMenu.classList.add("hidden");
      mobileMenuButton.innerHTML = '<i class="fas fa-bars text-xl"></i>';
      document.body.classList.remove("overflow-hidden");
    }
  });

  // Add event listener for sidebar close button
  const closeBtn = document.getElementById("close-mobile-menu");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      mobileMenu.classList.add("hidden");
      mobileMenuButton.innerHTML = '<i class="fas fa-bars text-xl"></i>';
      document.body.classList.remove("overflow-hidden");
    });
  }

  // Close mobile menu when clicking any link inside it
  mobileMenu.addEventListener("click", function (e) {
    const target = e.target.closest("a");
    if (target) {
      mobileMenu.classList.add("hidden");
      mobileMenuButton.innerHTML = '<i class="fas fa-bars text-xl"></i>';
      document.body.classList.remove("overflow-hidden");
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !mobileMenu.classList.contains("hidden")) {
      mobileMenu.classList.add("hidden");
      mobileMenuButton.innerHTML = '<i class="fas fa-bars text-xl"></i>';
      document.body.classList.remove("overflow-hidden");
    }
  });
}

// ==============================================
// USER DROPDOWN TOGGLE (Desktop/mobile click support)
// ==============================================

function initUserDropdownToggle() {
  const userDropdown = document.getElementById("user-dropdown");
  const userMenuButton = document.getElementById("user-menu-button");
  const userMenu = document.getElementById("user-menu");

  if (!userDropdown || !userMenuButton || !userMenu) return;

  // Toggle dropdown on button click (useful for mobile where hover isn't available)
  userMenuButton.addEventListener("click", function (e) {
    e.stopPropagation();
    const isHidden =
      userMenu.classList.contains("invisible") ||
      userMenu.classList.contains("opacity-0");
    if (isHidden) {
      userMenu.classList.remove("opacity-0", "invisible");
      userMenu.classList.add("translate-y-0");
      userMenu.classList.remove("translate-y-2");
    } else {
      userMenu.classList.add("opacity-0", "invisible");
      userMenu.classList.remove("translate-y-0");
      userMenu.classList.add("translate-y-2");
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", function (e) {
    if (!userDropdown.contains(e.target)) {
      userMenu.classList.add("opacity-0", "invisible");
      userMenu.classList.remove("translate-y-0");
      userMenu.classList.add("translate-y-2");
    }
  });
}

// ==============================================
// NOTIFICATION SYSTEM
// ==============================================

function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm transform transition-all duration-300 translate-x-full`;

  // Set colors based on type
  switch (type) {
    case "success":
      notification.classList.add("bg-green-500", "text-white");
      break;
    case "error":
      notification.classList.add("bg-red-500", "text-white");
      break;
    case "warning":
      notification.classList.add("bg-yellow-500", "text-white");
      break;
    default:
      notification.classList.add("bg-blue-500", "text-white");
  }

  // Add content
  notification.innerHTML = `
        <div class="flex items-center">
            <span class="flex-1">${message}</span>
            <button class="ml-3 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

  // Add to body
  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.classList.remove("translate-x-full");
  }, 100);

  // Add close functionality
  const closeBtn = notification.querySelector("button");
  closeBtn.addEventListener("click", () => {
    notification.classList.add("translate-x-full");
    setTimeout(() => {
      notification.remove();
    }, 300);
  });

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add("translate-x-full");
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
  }, 5000);
}

// ==============================================
// LOGIN STATE IN THE NAVBAR
// ==============================================

function loadUserStatus() {
  const token = localStorage.getItem("token");
  const userData =
    localStorage.getItem("userData") || localStorage.getItem("user");

  if (token && userData) {
    let user;
    try {
      user = typeof userData === "string" ? JSON.parse(userData) : userData;
      if (!user) throw new Error("User data is empty");
    } catch (e) {
      console.error("Error parsing user data:", e);
      // User data is corrupted, clear it and treat as logged out
      localStorage.removeItem("token");
      localStorage.removeItem("userData");
      localStorage.removeItem("user");
      loadUserStatusForLoggedOut();
      return;
    }

    // Get user name - handle different data structures
    const userName =
      user.name ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      "User";
    const userEmail = user.email || "";

    // Hide Login CTA on desktop when logged in
    const loginButtonContainer = document.getElementById(
      "login-button-container"
    );
    if (loginButtonContainer) {
      loginButtonContainer.style.display = "none";
      loginButtonContainer.classList.add("hidden");
      loginButtonContainer.classList.remove("md:flex");
    }

    // Show user dropdown
    const userDropdown = document.getElementById("user-dropdown");
    if (userDropdown) {
      userDropdown.classList.remove("hidden");
      userDropdown.style.display = "block";

      // Update username in navbar
      const navbarUsername = document.getElementById("navbar-username");
      if (navbarUsername) {
        navbarUsername.textContent = userName.split(" ")[0] || "User";
      }

      // Update dropdown info
      const dropdownName = document.getElementById("dropdown-name");
      const dropdownEmail = document.getElementById("dropdown-email");
      if (dropdownName) dropdownName.textContent = userName;
      if (dropdownEmail) dropdownEmail.textContent = userEmail;

      // Update user avatar if available
      const userAvatar = document.getElementById("user-avatar");
      if (
        userAvatar &&
        (user.profileImage || (user.profile && user.profile.profileImage))
      ) {
        const path = user.profileImage || user.profile.profileImage;
        userAvatar.src = path.startsWith('http') || path.startsWith('/uploads/') ? path : `/uploads/${path}`;
      }

      // Setup logout button (only if not already attached)
      const logoutBtn = document.getElementById("dropdown-logout");
      if (logoutBtn && !logoutBtn.hasAttribute("data-logout-listener")) {
        logoutBtn.setAttribute("data-logout-listener", "true");
        logoutBtn.addEventListener("click", handleLogout);
      }
    }

    const mobileMenu = document.getElementById("mobile-menu");
    if (mobileMenu) {
      const mobileLoginLink = mobileMenu.querySelector(
        'a[href="portal.html"], a[href="portal.html#login"]'
      );

      if (mobileLoginLink) {
        mobileLoginLink.classList.add("hidden");
      }

      renderMobileProfileSection(user);
    }
  } else {
    loadUserStatusForLoggedOut();
  }
}

function loadUserStatusForLoggedOut() {
  const loginButtonContainer = document.getElementById(
    "login-button-container"
  );
  const portalLoginLink = document.getElementById("portal-login-link");
  if (loginButtonContainer) {
    loginButtonContainer.style.display = "";
    loginButtonContainer.classList.remove("hidden");
    loginButtonContainer.classList.add("md:flex");
  }
  if (portalLoginLink) {
    portalLoginLink.textContent = "Login";
    portalLoginLink.setAttribute("href", "portal.html#login");
  }

  const userDropdown = document.getElementById("user-dropdown");
  if (userDropdown) {
    userDropdown.classList.add("hidden");
  }

  const mobileMenu = document.getElementById("mobile-menu");
  if (mobileMenu) {
    const mobileLoginLink = mobileMenu.querySelector(
      'a[href="portal.html"], a[href="portal.html#login"]'
    );
    if (mobileLoginLink) {
      mobileLoginLink.classList.remove("hidden");
      mobileLoginLink.setAttribute("href", "portal.html#login");
    }
    const existingProfile = document.getElementById("mobile-profile-section");
    if (existingProfile) existingProfile.remove();
  }
}

// ==============================================
// MOBILE PROFILE SECTION RENDERING
// ==============================================

function renderMobileProfileSection(user) {
  const mobileMenu = document.getElementById("mobile-menu");
  if (!mobileMenu) return;

  let section = document.getElementById("mobile-profile-section");
  const container =
    mobileMenu.querySelector(".px-2") ||
    mobileMenu.querySelector(".sm:px-3") ||
    mobileMenu.querySelector(".space-y-1") ||
    mobileMenu.querySelector("div");
  if (!container) return;

  const userName =
    user.name ||
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    "User";
  const userEmail = user.email || "";
  const rawPath = user.profileImage || (user.profile && user.profile.profileImage);
  let profileImage = "images/singlee person.webp";
  if (rawPath) {
    profileImage = rawPath.startsWith('http') || rawPath.startsWith('/uploads/') ? rawPath : `/uploads/${rawPath}`;
  }

  if (!section) {
    section = document.createElement("div");
    section.id = "mobile-profile-section";
    section.className = "border-b pb-3 mb-3";
    section.innerHTML = `
            <div class="flex items-center px-3 py-2">
                <img src="${profileImage}" alt="User Avatar" class="w-10 h-10 rounded-full object-cover mr-3">
                <div>
                    <p class="text-sm font-semibold">${userName}</p>
                    <p class="text-xs text-gray-500">${userEmail}</p>
                </div>
            </div>
            <div class="px-3 space-y-1">
              <a href="profile.html"
                class="block px-4 py-2 text-sm text-gray-700 hover:bg-primary-indigo hover:text-white transition duration-200"><i
                  class="fas fa-user mr-2"></i>My Profile</a>
                <button id="mobile-logout-btn" class="block w-full text-left text-red-600 hover:bg-red-50 px-3 py-2 rounded-md text-sm">Logout</button>
            </div>
        `;
    container.prepend(section);
  } else {
    const img = section.querySelector("img");
    const nameEl = section.querySelector("p.font-semibold");
    const emailEl = section.querySelector("p.text-gray-500");
    if (img) img.src = profileImage;
    if (nameEl) nameEl.textContent = userName;
    if (emailEl) emailEl.textContent = userEmail;
  }

  const logoutBtn = document.getElementById("mobile-logout-btn");
  if (logoutBtn && !logoutBtn.hasAttribute("data-bound")) {
    logoutBtn.setAttribute("data-bound", "true");
    logoutBtn.addEventListener("click", function () {
      // Close menu before logout
      mobileMenu.classList.add("hidden");
      const mobileMenuButton = document.getElementById("mobile-menu-button");
      if (mobileMenuButton)
        mobileMenuButton.innerHTML = '<i class="fas fa-bars text-xl"></i>';
      document.body.classList.remove("overflow-hidden");
      handleLogout();
    });
  }
}

// ==============================================
// LOGOUT FUNCTIONALITY
// ==============================================

function handleLogout() {
  // Notify the server (best effort; stateless JWT logout is client-side)
  const token = localStorage.getItem("token");
  if (token) {
    fetch("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => { /* token already cleared locally */ });
  }

  // Clear all user session data from localStorage
  localStorage.removeItem("token");
  localStorage.removeItem("userData");
  localStorage.removeItem("user");

  // Determine redirect URL based on current page
  const currentPage = window.location.pathname;
  let redirectUrl = "index.html";

  // If on profile pages, redirect to portal/login
  if (currentPage.includes("profile.html") || currentPage.includes("edit-profile.html")) {
    redirectUrl = "portal.html#login";
  }
  // If on portal page, stay on portal but show login
  else if (currentPage.includes("portal.html")) {
    window.location.hash = "login";
    window.location.reload();
    return;
  }

  window.location.href = redirectUrl;
}

// ==============================================
// SMOOTH SCROLLING FOR ANCHOR LINKS
// ==============================================

document.addEventListener("DOMContentLoaded", function () {
  const anchorLinks = document.querySelectorAll('a[href^="#"]');
  anchorLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (href === "#") return; // Ignore placeholder links
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });
});
