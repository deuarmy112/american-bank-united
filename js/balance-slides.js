// Balance Slides Carousel
document.addEventListener('DOMContentLoaded', () => {
  initBalanceSlides();
  // re-render when accounts change
  window.addEventListener('accounts:updated', (e) => { initBalanceSlides(); });
});

async function initBalanceSlides(){
  const container = document.getElementById('balanceSlides');
  const indicators = document.getElementById('balanceIndicators');
  if(!container) return;
  container.innerHTML = '<div class="p-6 w-full text-center">Loading...</div>';
  try{
    const accounts = await accountsAPI.getAll();
    const slides = [];

    // total slide
    const total = (accounts || []).reduce((s,a)=> s + (parseFloat(a.balance)||0), 0);
    slides.push({ id: 'total', title: 'Total Balance', subtitle: '', amount: total, bgClass: 'opay-balance-gradient' });

    // per-account slides
    (accounts || []).forEach((acc)=>{
      slides.push({
        id: acc.id,
        title: `${capitalize(acc.account_type||'Account')} • ****${String(acc.account_number||'').slice(-4)}`,
        subtitle: acc.account_nickname || '',
        amount: parseFloat(acc.balance) || 0,
        bgClass: 'opay-balance-gradient'
      });
    });

    // render slides
    container.innerHTML = '';
    slides.forEach(s=>{
      const el = document.createElement('div');
      el.className = 'p-4';
        el.innerHTML = `<div class="${s.bgClass} text-white rounded-2xl p-4" style="min-height:11rem">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm opacity-90">${s.title}</p>
              <p class="text-2xl font-bold mt-2">${formatCurrency(s.amount)}</p>
              ${s.subtitle? `<div class="text-xs opacity-80 mt-1">${s.subtitle}</div>`: ''}
            </div>
            <div class="text-right">
              <p class="text-xs opacity-90">Available</p>
              <p class="text-sm opacity-80 mt-1">${formatCurrency(s.amount)}</p>
            </div>
          </div>
          <div class="mt-4 flex gap-3">
            <button onclick="location.href='deposit.html'" class="flex-none w-20 bg-white/20 rounded-lg py-2 text-sm hover:bg-white/30 transition-colors">Deposit</button>
            <button onclick="location.href='transfer.html'" class="flex-none w-20 bg-white/20 rounded-lg py-2 text-sm hover:bg-white/30 transition-colors">Transfer</button>
            <button onclick="location.href='withdraw.html'" class="flex-none w-20 bg-white/20 rounded-lg py-2 text-sm hover:bg-white/30 transition-colors">Withdraw</button>
          </div>
        </div>`;
      container.appendChild(el);
    });

    // sizing helpers
    function getSlideWidth(){ return container.parentElement?.clientWidth || container.clientWidth || 300; }
    function applySizing(){
      const w = getSlideWidth();
      Array.from(container.children).forEach(ch=> ch.style.minWidth = w + 'px');
      container.style.width = (w * slides.length) + 'px';
    }
    applySizing();

    // indicators
    if (indicators) {
      indicators.innerHTML = '';
      slides.forEach((s,i)=>{
        const b = document.createElement('button');
        b.className = i===0? 'w-3 h-3 rounded-full bg-slate-800': 'w-3 h-3 rounded-full bg-slate-300';
        b.addEventListener('click', ()=> goToSlide(i));
        indicators.appendChild(b);
      });
    }

    // sliding logic with pointer/touch drag and prev/next
    let idx = 0;
    let isDown = false;
    let startX = 0;
    let currentTranslate = 0;

    function setTranslate(x){ container.style.transform = `translateX(${x}px)`; }

    function updateIndicators(){ if (!indicators) return; Array.from(indicators.children).forEach((c,ci)=> c.classList.toggle('bg-slate-800', ci===idx)); }

    function goToSlide(i){
      idx = Math.max(0, Math.min(i, slides.length-1));
      const width = getSlideWidth();
      container.style.transition = 'transform 300ms';
      container.style.transform = `translateX(${-idx * width}px)`;
      updateIndicators();
      setTimeout(()=> container.style.transition = '', 300);
    }

    // pointer events
    container.addEventListener('pointerdown', (e)=>{
      isDown = true; startX = e.clientX; currentTranslate = -idx * getSlideWidth(); try{ container.setPointerCapture?.(e.pointerId); }catch(e){}
    });
    container.addEventListener('pointermove', (e)=>{
      if(!isDown) return;
      const dx = e.clientX - startX;
      setTranslate(currentTranslate + dx);
    });
    container.addEventListener('pointerup', (e)=>{
      if(!isDown) return; isDown = false; const dx = e.clientX - startX; const threshold = (getSlideWidth() || 300) * 0.15;
      if (dx < -threshold) goToSlide(idx+1);
      else if (dx > threshold) goToSlide(idx-1);
      else goToSlide(idx);
    });
    container.addEventListener('pointercancel', ()=>{ if(isDown){ isDown=false; goToSlide(idx); } });

    // prev/next controls (exposed globally)
    window.balancePrev = ()=> goToSlide(idx-1);
    window.balanceNext = ()=> goToSlide(idx+1);

    // attach global function for click handlers above
    window.goToBalanceSlide = goToSlide;

    // recompute sizes on resize
    window.addEventListener('resize', ()=>{ applySizing(); goToSlide(idx); });

  }catch(err){
    console.error('Balance slides failed', err);
    container.innerHTML = '<div class="p-4 text-sm text-rose-600">Failed to load balances</div>';
  }
}
