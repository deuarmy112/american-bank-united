/* Sidebar functionality for ABU banking app
   Provides tools and services menu accessible from bottom navigation
*/

// Inject sidebar HTML into the page
function injectSidebar() {
    if (document.getElementById('abu-sidebar')) return;

    const sidebarHTML = `
        <!-- Sidebar Menu -->
        <div id="abu-sidebar" class="fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-2xl transform translate-x-full transition-transform duration-300 ease-in-out">
            <div class="flex flex-col h-full">
                <!-- Sidebar Header -->
                <div class="bg-indigo-600 text-white p-6">
                    <div class="flex items-center justify-between">
                        <h2 class="text-xl font-bold">Tools & Services</h2>
                        <button onclick="closeSidebar()" class="text-white hover:text-indigo-200">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <p class="text-indigo-100 text-sm mt-1">Useful banking tools at your fingertips</p>
                </div>

                <!-- Tools Grid -->
                <div class="flex-1 p-6 overflow-y-auto">
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Calculator -->
                        <div onclick="openCalculator()" class="bg-slate-50 hover:bg-slate-100 p-4 rounded-lg cursor-pointer transition-colors">
                            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                                <i class="fas fa-calculator text-blue-600 text-xl"></i>
                            </div>
                            <h3 class="font-semibold text-slate-900 mb-1">Calculator</h3>
                            <p class="text-xs text-slate-600">Financial calculations</p>
                        </div>

                        <!-- Currency Converter -->
                        <div onclick="openCurrencyConverter()" class="bg-slate-50 hover:bg-slate-100 p-4 rounded-lg cursor-pointer transition-colors">
                            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                                <i class="fas fa-exchange-alt text-green-600 text-xl"></i>
                            </div>
                            <h3 class="font-semibold text-slate-900 mb-1">Exchange</h3>
                            <p class="text-xs text-slate-600">Currency rates</p>
                        </div>

                        <!-- ATM Locator -->
                        <div onclick="openATMLocator()" class="bg-slate-50 hover:bg-slate-100 p-4 rounded-lg cursor-pointer transition-colors">
                            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                                <i class="fas fa-map-marker-alt text-red-600 text-xl"></i>
                            </div>
                            <h3 class="font-semibold text-slate-900 mb-1">ATM Locator</h3>
                            <p class="text-xs text-slate-600">Find nearby ATMs</p>
                        </div>

                        <!-- Budget Planner -->
                        <div onclick="openBudgetPlanner()" class="bg-slate-50 hover:bg-slate-100 p-4 rounded-lg cursor-pointer transition-colors">
                            <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                                <i class="fas fa-chart-pie text-purple-600 text-xl"></i>
                            </div>
                            <h3 class="font-semibold text-slate-900 mb-1">Budget</h3>
                            <p class="text-xs text-slate-600">Financial planning</p>
                        </div>

                        <!-- Support -->
                        <div onclick="openSupport()" class="bg-slate-50 hover:bg-slate-100 p-4 rounded-lg cursor-pointer transition-colors">
                            <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-3">
                                <i class="fas fa-headphones text-yellow-600 text-xl"></i>
                            </div>
                            <h3 class="font-semibold text-slate-900 mb-1">Support</h3>
                            <p class="text-xs text-slate-600">Get help</p>
                        </div>

                        <!-- Settings -->
                        <div onclick="openSettings()" class="bg-slate-50 hover:bg-slate-100 p-4 rounded-lg cursor-pointer transition-colors">
                            <div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                <i class="fas fa-cog text-slate-600 text-xl"></i>
                            </div>
                            <h3 class="font-semibold text-slate-900 mb-1">Settings</h3>
                            <p class="text-xs text-slate-600">App preferences</p>
                        </div>
                    </div>

                    <!-- Quick Actions Section -->
                    <div class="mt-8">
                        <h3 class="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
                        <div class="space-y-3">
                            <button onclick="location.href='deposit.html'" class="w-full flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                                <i class="fas fa-plus-circle text-green-600"></i>
                                <span class="text-slate-900">Make a Deposit</span>
                            </button>
                            <button onclick="location.href='transfer.html'" class="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                                <i class="fas fa-paper-plane text-blue-600"></i>
                                <span class="text-slate-900">Transfer Money</span>
                            </button>
                            <button onclick="location.href='withdraw.html'" class="w-full flex items-center gap-3 p-3 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                                <i class="fas fa-minus-circle text-red-600"></i>
                                <span class="text-slate-900">Withdraw Funds</span>
                            </button>
                            <button onclick="location.href='cards.html'" class="w-full flex items-center gap-3 p-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                                <i class="fas fa-credit-card text-indigo-600"></i>
                                <span class="text-slate-900">Manage Cards</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Sidebar Footer -->
                <div class="border-t border-slate-200 p-6">
                    <div class="flex items-center gap-3 mb-4">
                        <img id="sidebarAvatar" src="https://via.placeholder.com/40" class="w-10 h-10 rounded-full" alt="avatar">
                        <div>
                            <div id="sidebarName" class="font-medium text-slate-900">User</div>
                            <div id="sidebarEmail" class="text-sm text-slate-500">user@example.com</div>
                        </div>
                    </div>
                    <button onclick="logout()" class="w-full flex items-center gap-3 p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                        <i class="fas fa-sign-out-alt text-slate-600"></i>
                        <span class="text-slate-900">Logout</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Sidebar Overlay -->
        <div id="sidebarOverlay" class="fixed inset-0 bg-black/50 z-40 hidden" onclick="closeSidebar()"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', sidebarHTML);
}

// Sidebar functionality
function toggleSidebar() {
    const sidebar = document.getElementById('abu-sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (!sidebar || !overlay) {
        console.error('Sidebar elements not found');
        return;
    }

    if (sidebar.classList.contains('translate-x-full')) {
        openSidebar();
    } else {
        closeSidebar();
    }
}

function openSidebar() {
    const sidebar = document.getElementById('abu-sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (!sidebar || !overlay) {
        console.error('Sidebar elements not found');
        return;
    }

    sidebar.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');

    // Load user info for sidebar
    loadSidebarUserInfo();
}

function closeSidebar() {
    const sidebar = document.getElementById('abu-sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (!sidebar || !overlay) {
        console.error('Sidebar elements not found');
        return;
    }

    sidebar.classList.add('translate-x-full');
    overlay.classList.add('hidden');
}

async function loadSidebarUserInfo() {
    try {
        if (typeof authAPI !== 'undefined' && authAPI.getProfile) {
            const user = await authAPI.getProfile();
            const nameElement = document.getElementById('sidebarName');
            const emailElement = document.getElementById('sidebarEmail');
            const avatarElement = document.getElementById('sidebarAvatar');

            if (nameElement) {
                nameElement.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
            }
            if (emailElement) {
                emailElement.textContent = user.email || '';
            }
            if (avatarElement && user.avatar) {
                avatarElement.src = user.avatar;
            }
        }
    } catch (error) {
        console.error('Failed to load sidebar user info:', error);
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        if (typeof authAPI !== 'undefined' && authAPI.logout) {
            authAPI.logout();
        } else {
            window.location.href = 'index.html';
        }
    }
}

// Tool functions
function openCalculator() {
    if (typeof showAlert !== 'undefined') {
        showAlert('Calculator feature coming soon!', 'info');
    } else {
        alert('Calculator feature coming soon!');
    }
}

function openCurrencyConverter() {
    if (typeof showAlert !== 'undefined') {
        showAlert('Currency converter feature coming soon!', 'info');
    } else {
        alert('Currency converter feature coming soon!');
    }
}

function openATMLocator() {
    if (typeof showAlert !== 'undefined') {
        showAlert('ATM locator feature coming soon!', 'info');
    } else {
        alert('ATM locator feature coming soon!');
    }
}

function openBudgetPlanner() {
    if (typeof showAlert !== 'undefined') {
        showAlert('Budget planner feature coming soon!', 'info');
    } else {
        alert('Budget planner feature coming soon!');
    }
}

function openSupport() {
    if (typeof showAlert !== 'undefined') {
        showAlert('Support feature coming soon!', 'info');
    } else {
        alert('Support feature coming soon!');
    }
}

function openSettings() {
    if (typeof showAlert !== 'undefined') {
        showAlert('Settings feature coming soon!', 'info');
    } else {
        alert('Settings feature coming soon!');
    }
}

// Initialize sidebar when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    injectSidebar();
});

// Make functions globally available
window.toggleSidebar = toggleSidebar;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.loadSidebarUserInfo = loadSidebarUserInfo;
window.logout = logout;
window.openCalculator = openCalculator;
window.openCurrencyConverter = openCurrencyConverter;
window.openATMLocator = openATMLocator;
window.openBudgetPlanner = openBudgetPlanner;
window.openSupport = openSupport;
window.openSettings = openSettings;