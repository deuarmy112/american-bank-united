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

// Fullscreen nav overlay: intercept nav link taps and open target page in a fullscreen iframe with a mandatory back button
function createFullscreenOverlay() {
  if (document.getElementById('fullscreenNavOverlay')) return;
  const o = document.createElement('div'); o.id = 'fullscreenNavOverlay';
  o.className = 'fixed inset-0 z-60 hidden bg-white';
  o.innerHTML = `
    <div style="height:100%;display:flex;flex-direction:column;">
      <div id="fullscreenNavHeader" style="flex:0 0 56px;display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid #eee;">
        <button id="fullscreenNavBack" style="margin-right:12px;padding:8px 12px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;">Back</button>
        <div id="fullscreenNavTitle" style="font-weight:600">Loading...</div>
      </div>
      <iframe id="fullscreenNavFrame" style="flex:1 1 auto;border:0;width:100%;height:100%;" src="about:blank"></iframe>
    </div>
  `;
  document.body.appendChild(o);
  document.getElementById('fullscreenNavBack').addEventListener('click', () => {
    closeFullscreenOverlay();
  });
}

function openFullscreenOverlay(url, title) {
  createFullscreenOverlay();
  const o = document.getElementById('fullscreenNavOverlay');
  const frame = document.getElementById('fullscreenNavFrame');
  const t = document.getElementById('fullscreenNavTitle');
  if (!o || !frame) return;
  frame.src = url;
  if (t) t.textContent = title || url;
  o.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeFullscreenOverlay() {
  const o = document.getElementById('fullscreenNavOverlay');
  const frame = document.getElementById('fullscreenNavFrame');
  if (!o) return;
  o.classList.add('hidden');
  if (frame) frame.src = 'about:blank';
  document.body.style.overflow = '';
}

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
    // Treat very large screens as desktop; smaller laptops keep the mobile bottom nav visible.
    const DESKTOP_BREAKPOINT = 1280; // px
    if (window.innerWidth >= DESKTOP_BREAKPOINT) document.body.classList.add('desktop');
    else document.body.classList.remove('desktop');
  }
  updateDesktopMode();
  window.addEventListener('resize', () => {
    // debounce slightly
    clearTimeout(window.__desktopModeTimer);
    window.__desktopModeTimer = setTimeout(updateDesktopMode, 120);
  });
  // Intercept nav link clicks on mobile-ish UI and open in fullscreen overlay
  document.body.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (!a || !a.href) return;
    // only intercept same-origin html links (no javascript: handlers)
    try {
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (!url.pathname.endsWith('.html')) return;
      // ignore links explicitly opting out
      if (a.dataset && a.dataset.fullscreen === 'false') return;
      // allow normal behaviour for ctrl/cmd clicks
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      // only intercept when viewport is narrow (mobile)
      if (window.innerWidth > 1280) return;
      e.preventDefault();
      const title = a.textContent.trim() || url.pathname.split('/').pop();
      // open in a new fullscreen wrapper tab instead of overlay
      // wrapper expects `src` param URL-encoded (path + search)
      const wrapper = '/fullscreen.html?src=' + encodeURIComponent(url.pathname + url.search + (url.hash || ''));
      window.open(wrapper, '_blank');
    } catch (err) { /* ignore parse errors */ }
  });
});
