(() => {
  const STORAGE_KEY = 'abu_navigation_stack';
  const currentPath = () => `${location.pathname.split('/').pop() || 'index.html'}${location.search}${location.hash}`;
  const readStack = () => {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  };
  const writeStack = stack => sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack.slice(-30)));

  function push(destination) {
    const stack = readStack();
    const current = currentPath();
    if (stack[stack.length - 1] !== current) stack.push(current);
    writeStack(stack);
    location.href = destination;
  }

  function back(fallback = 'dashboard.html') {
    const stack = readStack();
    const current = currentPath();
    if (stack[stack.length - 1] === current) stack.pop();
    const destination = stack.pop() || fallback;
    writeStack(stack);
    location.href = destination;
  }

  window.navigationStack = { push, back };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href]').forEach(link => {
      if (link.dataset.stackBound || link.target === '_blank' || link.hasAttribute('download') || link.hasAttribute('data-nav-back')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !url.pathname.endsWith('.html') || url.pathname === location.pathname && url.search === location.search) return;
      link.dataset.stackBound = 'true';
      link.addEventListener('click', event => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigationStack.push(`${url.pathname.split('/').pop()}${url.search}${url.hash}`);
      });
    });

    document.querySelectorAll('[data-nav-back]').forEach(control => {
      control.addEventListener('click', event => {
        event.preventDefault();
        navigationStack.back(control.dataset.navBack || 'dashboard.html');
      });
    });
  });
})();
