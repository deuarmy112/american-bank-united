/* 
 * Authentication Functions
 * Handles user login state and protection
 */

// Ensure a token exists only for authenticated users
function ensureAuthToken() {
    const token = localStorage.getItem('authToken');
    if (!token || token === 'guest-token') {
        localStorage.removeItem('authToken');
        return null;
    }
    return token;
}

// Check if user is logged in (has valid token)
function isLoggedIn() {
    return !!ensureAuthToken();
}

// Get current user from API
async function getCurrentUser() {
    try {
        if (!isLoggedIn()) {
            return null;
        }
        
        const user = await authAPI.getProfile();
        return user;
    } catch (error) {
        console.error('Failed to get current user:', error);
        return null;
    }
}

// Redirect to login if not authenticated
function requireAuth() {
    const token = ensureAuthToken();
    if (!token) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        authAPI.logout();
    }
}

// Display user name in navbar
// Display user name in navbar
async function displayUserName() {
    try {
        const user = await getCurrentUser();
        if (user) {
            const userNameElements = document.querySelectorAll('#userName, #userGreeting');
            userNameElements.forEach(element => {
                if (element.id === 'userGreeting') {
                    element.textContent = user.first_name;
                } else {
                    element.textContent = `${user.first_name} ${user.last_name}`;
                }
            });
        }
    } catch (error) {
        console.error('Failed to display user name:', error);
    }
}
// Initialize page with auth check
function initAuthPage() {
    if (!requireAuth()) return;
    displayUserName();
}
