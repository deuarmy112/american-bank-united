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
