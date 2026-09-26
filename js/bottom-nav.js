/* Bottom navigation injector for ABU app
   Injects a polished bottom nav into pages that include this script.
*/
(function(){
  if (document.getElementById('abu-bottom-nav')) return;

  const primaryPages = new Set(['dashboard.html', 'accounts.html', 'transfer.html', 'cards.html', 'more.html']);
  const currentPage = (window.location.pathname || '/dashboard.html').replace(/\\/g, '/').split('/').pop() || 'dashboard.html';
  const pageCloseSelector = '.qr-header-action, .bill-close, .invest-close, .account-close, .profile-close, .transactions-close, [data-page-close]';
  const pagesWithoutClose = new Set(['transactions.html']);
  const pageStyle = document.createElement('style');
  pageStyle.textContent = `#abu-bottom-nav.secondary-page-nav{display:none!important}.abu-overlay-open #abu-bottom-nav{display:none!important}.abu-page-close,.qr-header-action,.bill-close,.invest-close,.account-close,.profile-close,.transactions-close{cursor:pointer}.abu-page-close:focus,.abu-page-close:hover,.qr-header-action:hover,.bill-close:hover,.invest-close:hover,.account-close:hover,.profile-close:hover,.transactions-close:hover{color:#0f172a;background:#f8fafc}`;

  const nav = document.createElement('nav');
  nav.id = 'abu-bottom-nav';
  nav.className = 'opay-bottom-nav';
  nav.innerHTML = `
    <button class="bn-item" data-href="/dashboard.html" aria-label="Home">
      <i class="fa fa-home"></i>
      <span>Home</span>
    </button>
    <button class="bn-item" data-href="/accounts.html" aria-label="Accounts">
      <i class="fa fa-university"></i>
      <span>Accounts</span>
    </button>
    <button class="bn-item bn-action" data-href="/transfer.html" aria-label="Transfer">
      <i class="fa fa-paper-plane"></i>
      <span>Transfer</span>
    </button>
    <button class="bn-item" data-href="/cards.html" aria-label="Cards">
      <i class="fa fa-credit-card"></i>
      <span>Cards</span>
    </button>
    <!-- replaced Profile with Menu icon (opens sidebar) -->
    <button id="bnMenu" class="bn-item" aria-label="Menu" title="Menu">
      <i class="fa fa-bars"></i>
      <span>Menu</span>
    </button>
  `;

  // click handling
  nav.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-href]');
    if (!btn) return;
    const href = btn.getAttribute('data-href');
    if (href) window.location.href = href;
  });

  // menu button handling (open sidebar) — added because Profile was replaced
  function menuHandler(e){
    const m = e.target.closest && e.target.closest('#bnMenu');
    if (!m) return;
    if (typeof toggleSidebar === 'function') toggleSidebar();
    else if (typeof openSidebar === 'function') openSidebar();
  }
  nav.addEventListener('click', menuHandler);

  // mark active based on path
  function markActive(){
    const pathname = window.location.pathname || '/index.html';
    const path = pathname.replace(/\\/g,'/').split('/').pop() || 'index.html';
    nav.querySelectorAll('.bn-item').forEach(b=>{
      const href = b.getAttribute('data-href');
      if (!href) return;
      const hrefPath = href.split('/').pop();
      b.classList.toggle('active', hrefPath === path || (path==='index.html' && hrefPath==='index.html'));
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    document.head.appendChild(pageStyle);
    document.body.appendChild(nav);
    if (!primaryPages.has(currentPage)) {
      nav.classList.add('secondary-page-nav');
      nav.setAttribute('aria-hidden', 'true');
      nav.style.display = 'none';

      if (!pagesWithoutClose.has(currentPage) && !document.querySelector(pageCloseSelector)) {
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'abu-page-close';
        close.setAttribute('aria-label', 'Close and return');
        close.title = 'Close and return';
        close.innerHTML = '<i class="fas fa-xmark" aria-hidden="true"></i>';
        close.addEventListener('click', () => {
          if (document.referrer && document.referrer.startsWith(window.location.origin) && window.history.length > 1) window.history.back();
          else window.location.href = '/dashboard.html';
        });
        const closeRow = document.createElement('div');
        closeRow.className = 'abu-page-topbar';
        closeRow.appendChild(close);
        const pageContent = document.querySelector('main') || document.body;
        pageContent.insertBefore(closeRow, pageContent.firstChild);
      }
    }
    markActive();

    if (!nav.classList.contains('secondary-page-nav')) {
      let idleTimer = null;
      const IDLE_DELAY = 800;
      const activePointers = new Set();
      const activeTouches = new Set();
      const activeKeys = new Set();

      function showBottomNav() {
        nav.classList.remove('abu-nav-idle-hidden');
        nav.removeAttribute('aria-hidden');
        nav.inert = false;
      }

      function hideBottomNav() {
        nav.classList.add('abu-nav-idle-hidden');
        nav.setAttribute('aria-hidden', 'true');
        nav.inert = true;
      }

      function hideDuringActivity() {
        hideBottomNav();
        window.clearTimeout(idleTimer);
      }

      function revealWhenIdle() {
        window.clearTimeout(idleTimer);
        if (activePointers.size || activeTouches.size || activeKeys.size) return;
        idleTimer = window.setTimeout(showBottomNav, IDLE_DELAY);
      }

      function isNavInteraction(event) {
        return event.target && nav.contains(event.target);
      }

      function registerActivity(event) {
        if (isNavInteraction(event)) return;
        hideDuringActivity();
        revealWhenIdle();
      }

      window.addEventListener('pointerdown', event => {
        if (isNavInteraction(event)) return;
        activePointers.add(event.pointerId);
        hideDuringActivity();
      }, { passive: true });
      ['pointerup', 'pointercancel'].forEach(type => window.addEventListener(type, event => {
        activePointers.delete(event.pointerId);
        revealWhenIdle();
      }, { passive: true }));
      window.addEventListener('touchstart', event => {
        if (isNavInteraction(event)) return;
        Array.from(event.changedTouches, touch => activeTouches.add(touch.identifier));
        hideDuringActivity();
      }, { passive: true });
      ['touchend', 'touchcancel'].forEach(type => window.addEventListener(type, event => {
        Array.from(event.changedTouches, touch => activeTouches.delete(touch.identifier));
        revealWhenIdle();
      }, { passive: true }));
      window.addEventListener('keydown', event => {
        if (isNavInteraction(event)) return;
        activeKeys.add(event.code);
        hideDuringActivity();
      }, { passive: true });
      window.addEventListener('keyup', event => {
        activeKeys.delete(event.code);
        revealWhenIdle();
      }, { passive: true });
      ['scroll', 'wheel', 'touchmove', 'pointermove', 'input', 'change', 'focusin'].forEach(type => {
        window.addEventListener(type, registerActivity, { passive: type !== 'focusin', capture: type === 'scroll' });
      });
    }

    // handle history changes
    window.addEventListener('popstate', markActive);
  });

})();
