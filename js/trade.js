// trade.js — handles external trading portal modal and redirect
(function () {
  function showShellModal() {
    const modal = document.getElementById('shellModal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeShellModal() {
    const modal = document.getElementById('shellModal');
    if (modal) modal.classList.add('hidden');
  }

  function openShellPortal() {
    // Safe external navigation: open in new tab and close modal
    const url = 'https://www.shell.com/business-customers/chemicals.html';
    window.open(url, '_blank', 'noopener,noreferrer');
    closeShellModal();
  }

  // Expose to global for inline onclick handlers
  window.showShellModal = showShellModal;
  window.closeShellModal = closeShellModal;
  window.openShellPortal = openShellPortal;

})();
