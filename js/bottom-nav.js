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
    <button class="bn-item" data-href="/profile.html" aria-label="Profile">
      <i class="fa fa-user"></i>
      <span>Profile</span>
    </button>
  `;

  // click handling
  nav.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-href]');
    if (!btn) return;
    const href = btn.getAttribute('data-href');
    if (href) window.location.href = href;
  });

  // mark active based on path
  function markActive(){
    const path = window.location.pathname.replace(/\\/g,'/').split('/').pop() || 'index.html';
    nav.querySelectorAll('.bn-item').forEach(b=>{
      const href = b.getAttribute('data-href').split('/').pop();
      b.classList.toggle('active', href === path || (path==='index.html' && href==='index.html'));
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
