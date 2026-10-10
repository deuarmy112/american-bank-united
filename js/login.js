/* 
 * Login Page Script - API Version
 */

document.addEventListener('DOMContentLoaded', function() {
    // Redirect if already logged in
    if (isLoggedIn()) {
        window.location.href = 'dashboard.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');
    const emailCodeStep = document.getElementById('loginEmailCodeStep');
    const emailCodeInput = document.getElementById('loginEmailCode');
    const emailCodeStatus = document.getElementById('loginEmailCodeStatus');

    function getLoginDeviceId() {
        let deviceId = localStorage.getItem('abuLoginDeviceId');
        if (!deviceId || !/^[a-zA-Z0-9-]{20,80}$/.test(deviceId)) {
            const bytes = new Uint8Array(16);
            window.crypto.getRandomValues(bytes);
            deviceId = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
            localStorage.setItem('abuLoginDeviceId', deviceId);
        }
        return deviceId;
    }

    async function requestLoginEmailCode(email, password) {
        try {
            const result = await authAPI.login(email, password, getLoginDeviceId());
            if (emailCodeStatus) emailCodeStatus.textContent = result.message || 'Check your email for the sign-in code.';
        } catch (error) {
            if (emailCodeStatus) emailCodeStatus.textContent = error.message || 'Could not send a sign-in code.';
        }
    }

    // Password visibility toggle
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.querySelector('i').classList.toggle('fa-eye');
            togglePassword.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }

    // Handle login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe')?.checked;
        const emailCode = emailCodeInput?.value.trim() || '';
        
        // Validate inputs
        if (!email || !password) {
            showAlert('Please fill in all fields', 'error');
            return;
        }

        try {
            // Show loading state
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Logging in...';
            submitBtn.disabled = true;

            // Call login API
            const response = await authAPI.login(email, password, getLoginDeviceId(), emailCode);
            if (response.requiresEmailVerification) {
                emailCodeStep.classList.remove('hidden');
                emailCodeInput.required = true;
                emailCodeInput.focus();
                emailCodeStatus.textContent = response.message || 'Check your email for the sign-in code.';
                submitBtn.textContent = 'Verify email and sign in';
                submitBtn.disabled = false;
                return;
            }

            // Store remember me preference
            if (rememberMe) {
                localStorage.setItem('rememberMe', 'true');
                localStorage.setItem('userEmail', email);
            } else {
                localStorage.removeItem('rememberMe');
                localStorage.removeItem('userEmail');
            }

            showAlert('Login successful! Redirecting...', 'success');
            
            const returnTo = new URLSearchParams(window.location.search).get('returnTo');
            setTimeout(() => {
                const destination = returnTo && (returnTo.startsWith('dashboard.html') || returnTo.startsWith('support.html')) ? returnTo : 'dashboard.html';
                window.location.href = destination;
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            showAlert(error.message || 'Login failed. Please check your credentials.', 'error');
            
            // Reset button
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.textContent = emailCodeStep.classList.contains('hidden') ? 'Login' : 'Verify email and sign in';
            submitBtn.disabled = false;
        }
    });

    document.getElementById('resendLoginEmailCode')?.addEventListener('click', () => {
        requestLoginEmailCode(document.getElementById('email').value.trim(), passwordInput.value);
    });

    // Pre-fill email if remembered
    const rememberMe = localStorage.getItem('rememberMe');
    const userEmail = localStorage.getItem('userEmail');
    if (rememberMe && userEmail) {
        document.getElementById('email').value = userEmail;
        if (document.getElementById('rememberMe')) {
            document.getElementById('rememberMe').checked = true;
        }
    }
});
