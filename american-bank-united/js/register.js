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
                dateOfBirth: dateOfBirth || null,
                password,
            });

            showAlert('Registration successful! Redirecting...', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);

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
