// Injects a consistent Opay-like header and bottom nav into pages
(function(){
  function shouldSkip() {
    // Skip auth and admin pages
    if (document.querySelector('#loginForm') || document.querySelector('#adminLoginForm')) return true;
    if (document.querySelector('.admin-login-container')) return true;
    if (document.body.classList.contains('auth-bg')) return true;
    // Skip admin pages by URL fragment
    if (window.location.pathname && window.location.pathname.includes('admin-')) return true;
    return false;
  }

  function injectHeader() {
    if (document.querySelector('.opay-header')) return; // already present

    const header = document.createElement('header');
    header.className = 'opay-header fixed top-0 left-0 right-0 bg-white shadow z-20';
    header.innerHTML = `
      <div class="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a href="dashboard.html" class="text-indigo-600 text-lg"><i class="fas fa-chevron-left"></i></a>
          <div>
            <div class="text-sm text-slate-400">Welcome back</div>
            <h1 class="text-lg font-semibold" id="pageTitle">Profile</h1>
          </div>
        </div>
        <div>
          <button id="globalLogoutBtn" class="text-sm text-rose-600">Logout</button>
        </div>
      </div>
    `;
    document.body.insertBefore(header, document.body.firstChild);

    const logoutBtn = document.getElementById('globalLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      if (confirm('Logout?')) {
        if (window.authAPI && typeof authAPI.logout === 'function') return authAPI.logout();
        localStorage.removeItem('authToken');
        window.location.href = 'index.html';
      }
    });
  }

  function injectBottomNav() {
    if (document.querySelector('.global-bottom-nav')) return; // already present
    const nav = document.createElement('nav');
    nav.className = 'global-bottom-nav fixed bottom-4 left-0 right-0 max-w-2xl mx-auto px-4';
    nav.innerHTML = `
      <div class="bg-white rounded-xl shadow flex items-center justify-between px-4 py-2">
        <a href="dashboard.html" class="text-center text-slate-600 text-sm"><i class="fas fa-home"></i><div>Home</div></a>
        <a href="transactions.html" class="text-center text-slate-600 text-sm"><i class="fas fa-exchange-alt"></i><div>Txn</div></a>
        <a href="transfer.html" class="text-center text-indigo-600 text-sm"><i class="fas fa-paper-plane"></i><div>Transfer</div></a>
        <a href="profile.html" class="text-center text-slate-600 text-sm"><i class="fas fa-user"></i><div>Profile</div></a>
      </div>
    `;
    document.body.appendChild(nav);
  }

  function setPageTitleFromH1() {
    if (!document.getElementById('pageTitle')) return;
    // Try to find an existing page title in h1/h2 elements
    const h1 = document.querySelector('h1') || document.querySelector('h2') || document.querySelector('.page-title');
    if (h1 && h1.textContent.trim().length > 0) {
      document.getElementById('pageTitle').textContent = h1.textContent.trim();
    } else {
      // fallback to document title
      const docTitle = document.title.replace(' - American Bank United', '').trim();
      if (docTitle) document.getElementById('pageTitle').textContent = docTitle;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (shouldSkip()) return;
    try {
      injectHeader();
      injectBottomNav();
      setPageTitleFromH1();
    } catch (e) { console.error('global-ui injector error', e); }
  });
})();
