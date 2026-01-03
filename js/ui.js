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

// Export for console access
window.appUI = { openFeatureSheet, closeFeatureSheet, toggleFeatureSheet };

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
