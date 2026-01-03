// External Transfers API functions
const externalTransfersAPI = {
    // Get all external transfers
    getAll: () => apiClient.get('/external-transfers/external'),

    // Send to user
    sendToUser: (data) => apiClient.post('/external-transfers/send-to-user', data),

    // Send to external bank
    sendToBank: (data) => apiClient.post('/external-transfers/send-to-bank', data),

    // Request money
    requestMoney: (data) => apiClient.post('/external-transfers/request-money', data),

    // Get all requests
    getRequests: () => apiClient.get('/external-transfers/requests'),

    // Pay a request
    payRequest: (requestId, fromAccountId) => 
        apiClient.post(`/external-transfers/requests/${requestId}/pay`, { fromAccountId }),

    // Decline a request
    declineRequest: (requestId) => 
        apiClient.post(`/external-transfers/requests/${requestId}/decline`)
};

let accounts = [];

// Load page data
async function loadPageData() {
    try {
        // Load accounts
        accounts = await accountsAPI.getAll();
        populateAccountDropdowns();

        // Load external transfers
        await loadExternalTransfers();

    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Failed to load data', 'error');
    }
}

// Populate account dropdowns
function populateAccountDropdowns() {
    const selects = ['fromAccountUser', 'fromAccountBank', 'toAccountRequest'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Select account...</option>';
        
        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.account_type.toUpperCase()} - ${account.account_number} ($${parseFloat(account.balance).toFixed(2)})`;
            select.appendChild(option);
        });
    });
}

// Load external transfers
async function loadExternalTransfers() {
    try {
        const transfers = await externalTransfersAPI.getAll();
        displayExternalTransfers(transfers);
    } catch (error) {
        console.error('Error loading transfers:', error);
    }
}

// Display external transfers
function displayExternalTransfers(transfers) {
    const container = document.getElementById('transfersList');
    
    if (transfers.length === 0) {
        container.innerHTML = '<p class="no-data">No external transfers yet</p>';
        return;
    }

    const html = transfers.map(transfer => {
        const isOutgoing = transfer.direction === 'outgoing';
        const icon = isOutgoing ? '📤' : '📥';
        const amountClass = isOutgoing ? 'expense' : 'income';
        const statusColors = {
            pending: '#FFA500',
            processing: '#2196F3',
            completed: '#4CAF50',
            failed: '#f44336',
            cancelled: '#9E9E9E'
        };

        return `
            <div class="transaction-item">
                <div class="transaction-icon">${icon}</div>
                <div class="transaction-details">
                    <div class="transaction-description">
                        <strong>${transfer.transfer_type.toUpperCase()}</strong> - ${transfer.recipient_name || 'Unknown'}
                        ${transfer.bank_name ? ` (${transfer.bank_name})` : ''}
                    </div>
                    <div class="transaction-date">${formatDate(transfer.created_at)}</div>
                    <div class="transaction-description" style="font-size: 0.85em; color: #666;">
                        ${transfer.description || ''}
                    </div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${isOutgoing ? '-' : '+'}$${parseFloat(transfer.amount).toFixed(2)}
                    <div style="font-size: 0.8em; color: ${statusColors[transfer.status]};">
                        ${transfer.status.toUpperCase()}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// Modal functions
function showSendToUserModal() {
    document.getElementById('sendToUserModal').style.display = 'block';
}

function closeSendToUserModal() {
    document.getElementById('sendToUserModal').style.display = 'none';
    document.getElementById('sendToUserForm').reset();
}

function showSendToBankModal() {
    document.getElementById('sendToBankModal').style.display = 'block';
}

function closeSendToBankModal() {
    document.getElementById('sendToBankModal').style.display = 'none';
    document.getElementById('sendToBankForm').reset();
}

function showRequestMoneyModal() {
    document.getElementById('requestMoneyModal').style.display = 'block';
}

function closeRequestMoneyModal() {
    document.getElementById('requestMoneyModal').style.display = 'none';
    document.getElementById('requestMoneyForm').reset();
}

async function showRequestsModal() {
    try {
        const requests = await externalTransfersAPI.getRequests();
        displayRequests(requests);
        document.getElementById('requestsModal').style.display = 'block';
    } catch (error) {
        console.error('Error loading requests:', error);
        showNotification('Failed to load requests', 'error');
    }
}

function closeRequestsModal() {
    document.getElementById('requestsModal').style.display = 'none';
}

// Display requests
function displayRequests(requests) {
    // Outgoing requests
    const outgoingContainer = document.getElementById('outgoingRequests');
    if (requests.outgoing.length === 0) {
        outgoingContainer.innerHTML = '<p class="no-data">No outgoing requests</p>';
    } else {
        outgoingContainer.innerHTML = requests.outgoing.map(req => `
            <div class="transaction-item">
                <div class="transaction-icon">📤</div>
                <div class="transaction-details">
                    <div class="transaction-description">
                        <strong>To:</strong> ${req.payer_email}
                    </div>
                    <div class="transaction-date">${formatDate(req.created_at)}</div>
                    <div>${req.description}</div>
                </div>
                <div class="transaction-amount">
                    $${parseFloat(req.amount).toFixed(2)}
                    <div style="font-size: 0.8em; color: ${req.status === 'pending' ? '#FFA500' : req.status === 'completed' ? '#4CAF50' : '#f44336'};">
                        ${req.status.toUpperCase()}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Incoming requests
    const incomingContainer = document.getElementById('incomingRequests');
    if (requests.incoming.length === 0) {
        incomingContainer.innerHTML = '<p class="no-data">No incoming requests</p>';
    } else {
        incomingContainer.innerHTML = requests.incoming.map(req => `
            <div class="transaction-item">
                <div class="transaction-icon">📥</div>
                <div class="transaction-details">
                    <div class="transaction-description">
                        <strong>From:</strong> ${req.requester_first_name} ${req.requester_last_name}
                    </div>
                    <div class="transaction-date">${formatDate(req.created_at)}</div>
                    <div>${req.description}</div>
                </div>
                <div class="transaction-amount">
                    $${parseFloat(req.amount).toFixed(2)}
                    ${req.status === 'pending' ? `
                        <div style="margin-top: 10px;">
                            <button class="btn btn-sm btn-primary" onclick="payRequest('${req.id}', ${req.amount})">Pay</button>
                            <button class="btn btn-sm" style="background: #f44336;" onclick="declineRequest('${req.id}')">Decline</button>
                        </div>
                    ` : `
                        <div style="font-size: 0.8em; color: ${req.status === 'completed' ? '#4CAF50' : '#f44336'};">
                            ${req.status.toUpperCase()}
                        </div>
                    `}
                </div>
            </div>
        `).join('');
    }
}

// Form handlers
document.getElementById('sendToUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        fromAccountId: document.getElementById('fromAccountUser').value,
        recipientEmail: document.getElementById('recipientEmail').value,
        amount: document.getElementById('amountUser').value,
        description: document.getElementById('descriptionUser').value
    };

    try {
        const result = await externalTransfersAPI.sendToUser(data);
        showNotification('Money sent successfully!', 'success');
        closeSendToUserModal();
        loadPageData();
    } catch (error) {
        showNotification(error.error || 'Failed to send money', 'error');
    }
});

document.getElementById('sendToBankForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        fromAccountId: document.getElementById('fromAccountBank').value,
        transferType: document.getElementById('transferType').value,
        bankName: document.getElementById('bankName').value,
        accountHolderName: document.getElementById('accountHolderName').value,
        accountNumber: document.getElementById('accountNumber').value,
        routingNumber: document.getElementById('routingNumber').value,
        amount: document.getElementById('amountBank').value,
        description: document.getElementById('descriptionBank').value
    };

    try {
        const result = await externalTransfersAPI.sendToBank(data);
        showNotification(result.message, 'success');
        closeSendToBankModal();
        loadPageData();
    } catch (error) {
        showNotification(error.error || 'Failed to send money', 'error');
    }
});

document.getElementById('requestMoneyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        toAccountId: document.getElementById('toAccountRequest').value,
        fromEmail: document.getElementById('fromEmail').value,
        amount: document.getElementById('amountRequest').value,
        description: document.getElementById('descriptionRequest').value
    };

    try {
        const result = await externalTransfersAPI.requestMoney(data);
        showNotification('Money request sent!', 'success');
        closeRequestMoneyModal();
    } catch (error) {
        showNotification(error.error || 'Failed to send request', 'error');
    }
});

// Pay/Decline request functions
async function payRequest(requestId, amount) {
    const fromAccountId = prompt(`Enter account ID to pay $${amount} from (or select from accounts page):`);
    if (!fromAccountId) return;

    try {
        await externalTransfersAPI.payRequest(requestId, fromAccountId);
        showNotification('Payment completed!', 'success');
        showRequestsModal(); // Refresh
        loadPageData();
    } catch (error) {
        showNotification(error.error || 'Payment failed', 'error');
    }
}

async function declineRequest(requestId) {
    if (!confirm('Are you sure you want to decline this request?')) return;

    try {
        await externalTransfersAPI.declineRequest(requestId);
        showNotification('Request declined', 'success');
        showRequestsModal(); // Refresh
    } catch (error) {
        showNotification(error.error || 'Failed to decline', 'error');
    }
}

// Close modals on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }
    
    displayUserName();
    loadPageData();
});
