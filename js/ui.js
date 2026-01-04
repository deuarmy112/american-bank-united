// Mobile bottom controls and feature sheet
function openFeatureSheet() {
  const sheet = document.getElementById('featureSheet');
  if (!sheet) return;
  sheet.classList.remove('translate-y-full','hidden');
  sheet.classList.add('translate-y-0');
  document.body.classList.add('overflow-hidden');
}

function closeFeatureSheet() {
  const sheet = document.getElementById('featureSheet');
  if (!sheet) return;
  sheet.classList.add('translate-y-full');
  setTimeout(() => sheet.classList.add('hidden'), 300);
  document.body.classList.remove('overflow-hidden');
}

function toggleFeatureSheet() {
  const sheet = document.getElementById('featureSheet');
  if (!sheet) return;
  if (sheet.classList.contains('hidden') || sheet.classList.contains('translate-y-full')) openFeatureSheet();
  else closeFeatureSheet();
}

// Close on ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeFeatureSheet();
});

// Close when clicking backdrop
function featureBackdropClick(e) {
  if (e.target.id === 'featureBackdrop') closeFeatureSheet();
}

// Sidebar and customer service controls
function openSidebar() {
  const panel = document.getElementById('sidebarPanel');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!panel || !backdrop) return;
  panel.classList.remove('-translate-x-full');
  backdrop.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeSidebar() {
  const panel = document.getElementById('sidebarPanel');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!panel || !backdrop) return;
  panel.classList.add('-translate-x-full');
  backdrop.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function toggleSidebar() {
  const panel = document.getElementById('sidebarPanel');
  if (!panel) return;
  if (panel.classList.contains('-translate-x-full')) openSidebar(); else closeSidebar();
}

function openCustomerServiceModal() {
  const m = document.getElementById('modal-cs');
  if (!m) return;
  m.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeCustomerServiceModal() {
  const m = document.getElementById('modal-cs');
  if (!m) return;
  m.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function logoutFromMenu() {
  if (!confirm('Logout?')) return;
  if (window.authAPI && typeof authAPI.logout === 'function') return authAPI.logout();
  localStorage.removeItem('authToken');
  window.location.href = 'index.html';
}

// Export for console access
window.appUI = { openFeatureSheet, closeFeatureSheet, toggleFeatureSheet };
// expose new UI helpers
window.appUI.openSidebar = openSidebar;
window.appUI.closeSidebar = closeSidebar;
window.appUI.toggleSidebar = toggleSidebar;
window.openCustomerServiceModal = openCustomerServiceModal;
window.closeCustomerServiceModal = closeCustomerServiceModal;
window.logoutFromMenu = logoutFromMenu;

// Remove duplicate bottom navs at runtime (keep the last one)
document.addEventListener('DOMContentLoaded', () => {
  const navs = document.querySelectorAll('.opay-bottom-nav');
  if (navs.length > 1) {
    for (let i = 0; i < navs.length - 1; i++) {
      navs[i].remove();
    }
  }
  // Toggle `desktop` class on body for larger viewports (laptop/desktop)
  function updateDesktopMode() {
    if (window.innerWidth >= 1024) document.body.classList.add('desktop');
    else document.body.classList.remove('desktop');
  }
  updateDesktopMode();
  window.addEventListener('resize', () => {
    // debounce slightly
    clearTimeout(window.__desktopModeTimer);
    window.__desktopModeTimer = setTimeout(updateDesktopMode, 120);
  });
});
