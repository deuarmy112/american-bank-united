/* 
 * Register Page Script
 */

document.addEventListener('DOMContentLoaded', function() {
    // Redirect if already logged in
    if (isLoggedIn()) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Handle register form submission
    const registerForm = document.getElementById('registerForm');
    const phoneInput = document.getElementById('phone');
    const emailInput = document.getElementById('email');
    const phoneStatus = document.getElementById('phoneVerificationStatus');
    const emailStatus = document.getElementById('emailVerificationStatus');
    let firebasePhoneAuthToken = '';
    let emailPhoneProof = '';
    let verifiedPhone = '';
    let verifiedEmail = '';

    document.getElementById('sendPhoneCode').addEventListener('click', async function() {
        try {
            await firebasePhoneAuth.sendCode(phoneInput.value, 'registerPhoneRecaptcha');
            document.getElementById('phoneCodeStep').classList.remove('hidden');
            phoneStatus.textContent = 'Enter the code sent to your phone.';
        } catch (error) {
            phoneStatus.textContent = error.message || 'Could not send a phone code. You can verify by email instead.';
        }
    });

    document.getElementById('confirmPhoneCode').addEventListener('click', async function() {
        try {
            const verification = await firebasePhoneAuth.confirmCode(document.getElementById('phoneCode').value);
            const enteredPhone = phoneInput.value.trim().replace(/[()\s.-]/g, '');
            if (verification.phoneNumber !== enteredPhone) throw new Error('The verified phone does not match the number entered.');
            firebasePhoneAuthToken = verification.idToken;
            emailPhoneProof = '';
            verifiedPhone = enteredPhone;
            verifiedEmail = '';
            phoneStatus.textContent = 'Phone verified.';
        } catch (error) {
            firebasePhoneAuthToken = '';
            phoneStatus.textContent = error.message || 'Phone verification failed.';
        }
    });

    document.getElementById('showEmailFallback').addEventListener('click', function() {
        document.getElementById('emailFallbackPanel').classList.toggle('hidden');
    });

    document.getElementById('sendEmailCode').addEventListener('click', async function() {
        try {
            await apiClient.post('/auth/phone-verification/request', { scope: 'register', email: emailInput.value.trim(), phone: phoneInput.value.trim() });
            document.getElementById('emailCodeStep').classList.remove('hidden');
            emailStatus.textContent = 'A verification code was sent to your email.';
        } catch (error) {
            emailStatus.textContent = error.message || 'Could not send an email verification code.';
        }
    });

    document.getElementById('confirmEmailCode').addEventListener('click', async function() {
        try {
            const result = await apiClient.post('/auth/phone-verification/confirm', {
                scope: 'register',
                email: emailInput.value.trim(),
                phone: phoneInput.value.trim(),
                code: document.getElementById('emailCode').value
            });
            emailPhoneProof = result.proof;
            firebasePhoneAuthToken = '';
            verifiedPhone = phoneInput.value.trim().replace(/[()\s.-]/g, '');
            verifiedEmail = emailInput.value.trim().toLowerCase();
            emailStatus.textContent = 'Email verified. Your phone will remain unverified until you confirm it by SMS.';
        } catch (error) {
            emailPhoneProof = '';
            emailStatus.textContent = error.message || 'Email verification failed.';
        }
    });

    phoneInput.addEventListener('input', function() {
        firebasePhoneAuthToken = '';
        emailPhoneProof = '';
        verifiedPhone = '';
        phoneStatus.textContent = 'Firebase sends your number to Google for SMS verification and abuse prevention. Message rates may apply.';
        emailStatus.textContent = 'Email verification confirms your account, not ownership of this phone number.';
    });
    emailInput.addEventListener('input', function() {
        emailPhoneProof = '';
        verifiedEmail = '';
    });

    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form values
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const dateOfBirth = document.getElementById('dateOfBirth').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        const normalizedPhone = phone.replace(/[()\s.-]/g, '');
        if (!verifiedPhone || verifiedPhone !== normalizedPhone || (!firebasePhoneAuthToken && (!emailPhoneProof || verifiedEmail !== email.toLowerCase()))) {
            showAlert('Verify this phone by SMS or verify your email before creating the account.', 'error');
            return;
        }
        
        // Validate inputs
        if (!firstName || !lastName || !email || !password) {
            showAlert('Please fill in all required fields', 'error');
            return;
        }
        
        // Validate email format
        if (!isValidEmail(email)) {
            showAlert('Please enter a valid email address', 'error');
            return;
        }
        
        // Validate age if provided (must be 18+)
        if (dateOfBirth) {
            const age = calculateAge(dateOfBirth);
            if (age < 18) {
                showAlert('You must be at least 18 years old to register', 'error');
                return;
            }
        }
        
        // Check if passwords match
        if (password !== confirmPassword) {
            showAlert('Passwords do not match', 'error');
            return;
        }
        
        // Check password length
        if (password.length < 6) {
            showAlert('Password must be at least 6 characters long', 'error');
            return;
   showAlert('An account with this email already exists', 'error');
            return;
        }
        
        try {
            // Show loading state
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Creating account...';
            submitBtn.disabled = true;

            // Call register API
            const response = await authAPI.register({
                firstName,
                lastName,
                email,
                phone: phone || null,
                firebasePhoneAuthToken: firebasePhoneAuthToken || undefined,
                emailPhoneProof: emailPhoneProof || undefined,
                dateOfBirth: dateOfBirth || null,
                password,
            });

            showAlert('Registration successful! Your account is pending admin approval. Please login to continue.', 'success');
            
            // Send new user back to login so they can sign in after approval
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1800);

        } catch (error) {
            console.error('Registration error:', error);
            showAlert(error.message || 'Registration failed. Please try again.', 'error');
            
            // Reset button
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Create Account';
            submitBtn.disabled = false;
        }
    });
});
