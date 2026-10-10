(function () {
    function addVisibilityToggle(input) {
        if (input.dataset.passwordVisibilityReady) return;
        const parent = input.parentElement;
        if (!parent) return;
        const existingToggle = [...parent.querySelectorAll('button')].some(button =>
            button.getAttribute('onclick')?.includes('togglePassword') || button.classList.contains('toggle-password')
        );
        if (existingToggle) return;

        input.dataset.passwordVisibilityReady = 'true';
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.width = '100%';
        parent.insertBefore(wrapper, input);
        wrapper.appendChild(input);
        input.style.paddingRight = '3rem';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'password-visibility-toggle';
        button.setAttribute('aria-label', 'Show password');
        button.title = 'Show password';
        button.style.cssText = 'position:absolute;top:50%;right:8px;transform:translateY(-50%);display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:6px;background:transparent;color:#64748b;cursor:pointer;';
        button.innerHTML = '<i class="fas fa-eye" aria-hidden="true"></i>';
        button.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
            button.title = show ? 'Hide password' : 'Show password';
            button.innerHTML = `<i class="fas ${show ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>`;
        });
        wrapper.appendChild(button);
    }

    function initializePasswordVisibility(root = document) {
        if (root.matches?.('input[type="password"]')) addVisibilityToggle(root);
        root.querySelectorAll?.('input[type="password"]').forEach(addVisibilityToggle);
    }

    window.initializePasswordVisibility = initializePasswordVisibility;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initializePasswordVisibility());
    } else {
        initializePasswordVisibility();
    }
})();
