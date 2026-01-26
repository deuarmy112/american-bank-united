/* Bottom navigation injector for ABU app
   Injects a polished bottom nav into pages that include this script.
*/
(function(){
  if (document.getElementById('abu-bottom-nav')) return;

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
    <button class="bn-item" data-href="/wallet.html" aria-label="Wallet">
      <i class="fa fa-wallet"></i>
      <span>Wallet</span>
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
    document.body.appendChild(nav);
    // allow forcing visible on specific pages (profile, wallet)
    const filename = window.location.pathname.replace(/\\/g,'/').split('/').pop() || '';
    if (['profile.html','wallet.html'].includes(filename)) nav.classList.add('force-visible');
    markActive();
    // handle history changes
    window.addEventListener('popstate', markActive);
  });

})();
