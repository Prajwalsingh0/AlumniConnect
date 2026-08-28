// Alumni Website - Main JavaScript File
// Handles navigation, dynamic content loading, and form interactions

document.addEventListener("DOMContentLoaded", function () {
  // Initialize all functionality
  initMobileNavigation();
  initUserDropdownToggle();
  initPasswordToggle();
  initFileUpload();
  initFormHandlers();
  loadDynamicContent();

  // Only initialize portal functionality if we're on the portal page
  if (window.location.pathname.includes("portal.html")) {
    if (typeof initPortalFormToggle === "function") {
      initPortalFormToggle();
    }
  }
});

// ==============================================
// NAVIGATION FUNCTIONALITY
// ==============================================

function initMobileNavigation() {
  const mobileMenuButton = document.getElementById("mobile-menu-button");
  const mobileMenu = document.getElementById("mobile-menu");

  // Only proceed if both elements exist
  if (!mobileMenuButton || !mobileMenu) {
    console.log(
      "Mobile navigation elements not found - skipping mobile menu initialization"
    );
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
// PASSWORD VISIBILITY TOGGLE
// ==============================================

function initPasswordToggle() {
  const passwordToggles = [
    "toggle-login-password",
    "toggle-reg-password",
    "toggle-confirm-password",
  ];

  passwordToggles.forEach((toggleId) => {
    const toggle = document.getElementById(toggleId);
    if (toggle) {
      toggle.addEventListener("click", function () {
        const input = toggle.parentElement.querySelector("input");
        const icon = toggle.querySelector("i");

        if (input.type === "password") {
          input.type = "text";
          icon.classList.remove("fa-eye");
          icon.classList.add("fa-eye-slash");
        } else {
          input.type = "password";
          icon.classList.remove("fa-eye-slash");
          icon.classList.add("fa-eye");
        }
      });
    }
  });
}

// ==============================================
// FILE UPLOAD FUNCTIONALITY
// ==============================================

function initFileUpload() {
  const fileInput = document.getElementById("resume-file");
  const dropArea = document.getElementById("file-drop-area");
  const fileName = document.getElementById("file-name");

  if (fileInput && dropArea) {
    // Click to upload
    dropArea.addEventListener("click", () => fileInput.click());

    // File input change
    fileInput.addEventListener("change", function (e) {
      handleFileSelect(e.target.files[0]);
    });

    // Drag and drop functionality
    dropArea.addEventListener("dragover", function (e) {
      e.preventDefault();
      dropArea.classList.add("border-blue-500", "bg-blue-50");
    });

    dropArea.addEventListener("dragleave", function (e) {
      e.preventDefault();
      dropArea.classList.remove("border-blue-500", "bg-blue-50");
    });

    dropArea.addEventListener("drop", function (e) {
      e.preventDefault();
      dropArea.classList.remove("border-blue-500", "bg-blue-50");
      handleFileSelect(e.dataTransfer.files[0]);
    });
  }

  function handleFileSelect(file) {
    if (file && fileName) {
      fileName.textContent = `Selected: ${file.name}`;
      fileName.classList.remove("hidden");
    }
  }
}

// ==============================================
// FORM HANDLERS
// ==============================================

function initFormHandlers() {
  // Login form
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // Registration form
  const registrationForm = document.getElementById("registration-form");
  if (registrationForm) {
    registrationForm.addEventListener("submit", handleRegistration);
  }

  // Event registration form
  const eventForm = document.getElementById("event-registration-form");
  if (eventForm) {
    eventForm.addEventListener("submit", handleEventRegistration);
  }

  // Story submission form
  const storyForm = document.getElementById("story-submission-form");
  if (storyForm) {
    storyForm.addEventListener("submit", handleStorySubmission);
  }

  // Resume upload form
  const resumeForm = document.getElementById("resume-upload-form");
  if (resumeForm) {
    resumeForm.addEventListener("submit", handleResumeUpload);
  }

  // Job-related functionality removed as per request
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email")?.value;
  const password = document.getElementById("login-password")?.value;

  if (!email || !password) {
    showNotification("Please fill in all fields", "error");
    return;
  }

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("userData", JSON.stringify(data.user));

    showNotification("Login successful! Welcome back.", "success");

    setTimeout(() => {
      if (typeof showDashboard === "function") {
        showDashboard();
      } else {
        window.location.href = "dashboard.html";
      }
    }, 1000);
  } catch (error) {
    showNotification(error.message, "error");
  }
}

async function handleRegistration(e) {
  e.preventDefault();

  const password = document.getElementById("reg-password")?.value;
  const confirmPassword = document.getElementById(
    "reg-confirm-password"
  )?.value;

  if (password !== confirmPassword) {
    showNotification("Passwords do not match!", "error");
    return;
  }

  const userData = {
    firstName: document.getElementById("reg-first-name")?.value,
    lastName: document.getElementById("reg-last-name")?.value,
    email: document.getElementById("reg-email")?.value,
    phone: document.getElementById("reg-phone")?.value,
    graduationYear: document.getElementById("reg-graduation-year")?.value,
    degree: document.getElementById("reg-degree")?.value,
    major: document.getElementById("reg-major")?.value,
    currentPosition: document.getElementById("reg-current-position")?.value,
    company: document.getElementById("reg-company")?.value,
    industry: document.getElementById("reg-industry")?.value,
    location: document.getElementById("reg-location")?.value,
    linkedin: document.getElementById("reg-linkedin")?.value,
    password: password,
    directory: document.getElementById("reg-directory")?.checked || false,
    newsletter: document.getElementById("reg-newsletter")?.checked || false,
    mentorship: document.getElementById("reg-mentorship")?.checked || false,
  };

  // Validate required fields
  const requiredFields = [
    "firstName",
    "lastName",
    "email",
    "graduationYear",
    "degree",
    "password",
  ];
  for (const field of requiredFields) {
    if (!userData[field]) {
      showNotification(
        `Please fill in ${field.replace(/([A-Z])/g, " $1").toLowerCase()}`,
        "error"
      );
      return;
    }
  }

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Registration failed");
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("userData", JSON.stringify(data.user));

    showNotification(
      "Registration successful! Welcome to the alumni network.",
      "success"
    );

    setTimeout(() => {
      if (typeof showDashboard === "function") {
        showDashboard();
      } else {
        window.location.href = "dashboard.html";
      }
    }, 1000);
  } catch (error) {
    showNotification(error.message, "error");
  }
}

function handleEventRegistration(e) {
  e.preventDefault();
  const formData = new FormData(e.target);

  showNotification("Event registration submitted successfully!", "success");
  e.target.reset();
}

function handleStorySubmission(e) {
  e.preventDefault();
  const formData = new FormData(e.target);

  showNotification(
    "Your story has been submitted for review. Thank you for sharing!",
    "success"
  );
  e.target.reset();
}

function handleResumeUpload(e) {
  e.preventDefault();
  const formData = new FormData(e.target);

  showNotification("Resume uploaded successfully to our database!", "success");
  e.target.reset();

  // Hide file name
  const fileName = document.getElementById("file-name");
  if (fileName) fileName.classList.add("hidden");
}

// Job-related functionality removed as per request

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
// DYNAMIC CONTENT LOADING
// ==============================================

function loadDynamicContent() {
  // Load any dynamic content that needs to be updated
  loadUserStatus();
  loadFeaturedContent();
}

function loadUserStatus() {
  // Check if user is logged in and update UI accordingly
  const token = localStorage.getItem("token");
  const userData =
    localStorage.getItem("userData") || localStorage.getItem("user");

  if (token && userData) {
    // User is logged in
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
      // Fall through to else block by returning or recursively calling?
      // Simpler: Just reload to clear state, or let the user click login again.
      // But better: Let's run the logged-out logic.
      // Since we can't easily jump to the else block, let's just nullify the token and let it fall through if we restructured.
      // But since we are inside if(token && userData), we need to manually invoke logged-out UI or reload.
      loadUserStatusForLoggedOut();
      return;
    }

    // Get user name - handle different data structures
    const userName =
      user.name ||
      user.firstName ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      "User";
    const userEmail = user.email || "";

    // Hide Login CTA on desktop when logged in
    const loginButtonContainer = document.getElementById(
      "login-button-container"
    );
    if (loginButtonContainer) {
      // Use inline style to force hide, overriding any classes
      loginButtonContainer.style.display = "none";
      loginButtonContainer.classList.add("hidden");
      loginButtonContainer.classList.remove("md:flex");
    }


    // Dashboard button removed - user dropdown has 'My Profile' link instead

    // Show user dropdown
    const userDropdown = document.getElementById("user-dropdown");
    if (userDropdown) {
      userDropdown.classList.remove("hidden");
      userDropdown.style.display = "block"; // Ensure it's visible

      // Update username in navbar
      const navbarUsername = document.getElementById("navbar-username");
      if (navbarUsername) {
        navbarUsername.textContent = userName.split(" ")[0] || "User"; // Show first name only
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

      if (typeof renderMobileProfileSection === "function") {
        renderMobileProfileSection(user);
      }
    }
  } else {
    loadUserStatusForLoggedOut();
  }
}

function loadUserStatusForLoggedOut() {
  // User is not logged in - show login button, hide user dropdown
  const loginButtonContainer = document.getElementById(
    "login-button-container"
  );
  const portalLoginLink = document.getElementById("portal-login-link");
  if (loginButtonContainer) {
    // Force show login button
    loginButtonContainer.style.display = ""; // Reset inline style to allow classes to take over, or force flex if needed. 
    // Actually, force flex if on desktop is safer if classes are flaky.
    // But let's try clearing first so media queries work.
    // If we want to support mobile hidden/desktop flex, we should relying on classes.
    // But since we had trouble hiding it, we used display:none.
    // To show it again, we remove display:none.
    loginButtonContainer.style.display = "";

    loginButtonContainer.classList.remove("hidden");
    loginButtonContainer.classList.add("md:flex");
  }
  if (portalLoginLink) {
    portalLoginLink.textContent = "Login";
    portalLoginLink.setAttribute("href", "portal.html#login");
  }

  // Hide Dashboard link in desktop navbar when logged out
  const dashboardButtonContainer = document.getElementById(
    "dashboard-button-container"
  );
  if (dashboardButtonContainer) {
    dashboardButtonContainer.style.display = "none";
    dashboardButtonContainer.classList.add("hidden");
    dashboardButtonContainer.classList.remove("md:flex");
  }

  const userDropdown = document.getElementById("user-dropdown");
  if (userDropdown) {
    userDropdown.classList.add("hidden");
  }

  const mobileMenu2 = document.getElementById("mobile-menu");
  if (mobileMenu2) {
    const mobileLoginLink = mobileMenu2.querySelector(
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
    user.firstName ||
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
  // Clear all user session data from localStorage
  localStorage.removeItem("token");
  localStorage.removeItem("userData");
  localStorage.removeItem("user");

  // Determine redirect URL based on current page
  const currentPage = window.location.pathname;
  let redirectUrl = "index.html";

  // If on dashboard, redirect to portal/login
  if (currentPage.includes("dashboard.html")) {
    redirectUrl = "portal.html#login";
  }
  // If on portal page, stay on portal but show login
  else if (currentPage.includes("portal.html")) {
    // Just reload to show login form
    window.location.hash = "login";
    window.location.reload();
    return;
  }
  // For all other pages, redirect to home
  else {
    redirectUrl = "index.html";
  }

  // Redirect to appropriate page
  window.location.href = redirectUrl;
}

function loadFeaturedContent() {
  // Load featured alumni stories, events, etc.
  // This would typically make API calls to fetch latest content

  // For now, just ensure all images load properly
  const images = document.querySelectorAll("img");
  images.forEach((img) => {
    img.addEventListener("error", function () {
      // Use a local SVG placeholder to avoid network errors
      this.src = "images/placeholder.svg";
    });
  });
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

// Helper function to safely get elements
function $(id) {
  return document.getElementById(id);
}

// Smooth scrolling for anchor links
document.addEventListener("DOMContentLoaded", function () {
  const anchorLinks = document.querySelectorAll('a[href^="#"]');
  anchorLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });
});

// Add loading animation for page transitions
window.addEventListener("beforeunload", function () {
  document.body.classList.add("page-loading");
});

// Handle browser back/forward buttons
window.addEventListener("popstate", function () {
  loadDynamicContent();
});
