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
    const emailStatus = document.getElementById('emailVerificationStatus');
    let emailPhoneProof = '';
    let verifiedEmail = '';
    const registrationIdentityOptions = {
        tier1: [['national_id', 'National ID card']],
        tier2: [['drivers_license', "Driver's license"], ['ssn_proof', 'SSN proof']],
        tier3: [['international_passport', 'International passport']]
    };

    function updateRegistrationIdentityType() {
        const tier = document.querySelector('input[name="registrationTier"]:checked')?.value || 'tier1';
        const select = document.getElementById('registrationIdentityType');
        select.innerHTML = registrationIdentityOptions[tier].map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
    }

    async function uploadVerificationFile(file) {
        if (!file || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            throw new Error('Upload a PDF, JPG, PNG, or WEBP document.');
        }
        if (file.type.startsWith('image/')) {
            const sourceImage = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = reject;
                    image.src = reader.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const scale = Math.min(1, 1400 / Math.max(sourceImage.width, sourceImage.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(sourceImage.width * scale));
            canvas.height = Math.max(1, Math.round(sourceImage.height * scale));
            canvas.getContext('2d').drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
            const compressed = canvas.toDataURL('image/jpeg', 0.68);
            if (compressed.length > 450000) throw new Error('Each document must be a clear image under 450 KB after compression.');
            return compressed;
        }

        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        if (dataUrl.length > 450000) throw new Error('Each PDF document must be 450 KB or smaller.');
        return dataUrl;
    }

    document.querySelectorAll('input[name="registrationTier"]').forEach(input => input.addEventListener('change', updateRegistrationIdentityType));
    updateRegistrationIdentityType();

    document.getElementById('sendEmailCode').addEventListener('click', async function() {
        try {
            if (!isValidEmail(emailInput.value.trim())) throw new Error('Enter a valid email address first.');
            if (!phoneInput.value.trim()) throw new Error('Enter your phone number first.');
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
            verifiedEmail = emailInput.value.trim().toLowerCase();
            emailStatus.textContent = 'Email verified. You can now create your account.';
        } catch (error) {
            emailPhoneProof = '';
            emailStatus.textContent = error.message || 'Email verification failed.';
        }
    });

    phoneInput.addEventListener('input', function() {
        emailPhoneProof = '';
        emailStatus.textContent = 'Changing your phone number requires a new email verification code.';
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
        const nickname = document.getElementById('nickname').value.trim();
        const gender = document.getElementById('gender').value;
        const address = document.getElementById('address').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const selectedTier = document.querySelector('input[name="registrationTier"]:checked')?.value || 'tier1';

        if (!emailPhoneProof || verifiedEmail !== email.toLowerCase()) {
            showAlert('Verify your email before creating the account.', 'error');
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
            submitBtn.textContent = 'Preparing verification documents...';
            submitBtn.disabled = true;

            const [identity, address] = await Promise.all([
                uploadVerificationFile(document.getElementById('registrationIdentityFile').files[0]),
                uploadVerificationFile(document.getElementById('registrationAddressFile').files[0])
            ]);
            submitBtn.textContent = 'Creating account...';

            // Call register API
            const response = await authAPI.register({
                firstName,
                lastName,
                email,
                phone: phone || null,
                nickname,
                gender,
                address,
                tier: selectedTier,
                identityType: document.getElementById('registrationIdentityType').value,
                documents: { identity, address },
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
