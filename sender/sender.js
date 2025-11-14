let token = null;
let currentUser = null;
let pollingInterval = null;
let currentPreviewQuery = null;

// Notification system
function showNotification(message, type = 'success') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
        ${message}
    `;
    container.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Enhanced login function
async function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const loginStatus = document.getElementById("loginStatus");

    if (!username || !password) {
        loginStatus.textContent = "Please enter both username and password";
        loginStatus.className = "status-error";
        return;
    }

    loginStatus.innerHTML = '<span class="loading"></span> Logging in...';
    loginStatus.className = "status-warning";

    try {
        const response = await fetch("http://localhost:3000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.token && data.role === "sender") {
            token = data.token;
            currentUser = username;
            document.getElementById("loginBox").style.display = "none";
            document.getElementById("panel").style.display = "block";
            showNotification("Login successful! Sender dashboard active.", 'success');
            startPolling();
            loadAvailableTables();
            updateStats();
        } else {
            loginStatus.textContent = data.message || "Login failed - Sender access only";
            loginStatus.className = "status-error";
        }
    } catch (error) {
        loginStatus.textContent = "Error connecting to server";
        loginStatus.className = "status-error";
        console.error("Login error:", error);
    }
}

// Enhanced polling with request handling
function startPolling() {
    // Clear any existing interval
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    // Immediate first check
    checkForRequests();
    
    // Set up polling every 3 seconds
    pollingInterval = setInterval(() => {
        checkForRequests();
    }, 3000);
}

// New function to check for and display requests
async function checkForRequests() {
    try {
        const response = await fetch("http://localhost:3000/sender-requests", {
            headers: { "Authorization": "Bearer " + token }
        });
        
        const data = await response.json();
        
        if (data.requests && data.requests.length > 0) {
            displayRequests(data.requests);
            updateStats(data.stats);
        } else {
            document.getElementById("requestsList").innerHTML = `
                <div class="status-info">
                    <i class="fas fa-info-circle"></i> No pending requests at the moment
                </div>
            `;
        }
    } catch (error) {
        console.error("Error checking requests:", error);
        document.getElementById("requestsList").innerHTML = `
            <div class="status-error">
                <i class="fas fa-exclamation-triangle"></i> Error loading requests
            </div>
        `;
    }
}

// New function to display requests with accept/reject buttons
function displayRequests(requests) {
    const requestsList = document.getElementById("requestsList");
    
    requestsList.innerHTML = requests.map(request => `
        <div class="request-card pending" id="request-${request.id}">
            <div class="request-header">
                <div class="request-info">
                    <h4>📋 ${request.table_name}</h4>
                    <div class="request-meta">
                        From: <strong>${request.sender_id}</strong> | 
                        Requested: ${new Date(request.created_at).toLocaleString()}
                    </div>
                </div>
                <div class="request-actions">
                    <button class="btn btn-success" onclick="handleRequest(${request.id}, 'approve')">
                        <i class="fas fa-check"></i> Accept
                    </button>
                    <button class="btn btn-danger" onclick="handleRequest(${request.id}, 'reject')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            </div>
            <div class="request-status" id="status-${request.id}"></div>
        </div>
    `).join('');
}

// New function to handle request approval/rejection
async function handleRequest(requestId, action) {
    const statusDiv = document.getElementById(`status-${requestId}`);
    const requestCard = document.getElementById(`request-${requestId}`);
    
    statusDiv.innerHTML = `<span class="loading"></span> Processing...`;
    statusDiv.className = "status-warning";
    
    // Disable buttons during processing
    const buttons = requestCard.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);

    try {
        const response = await fetch("http://localhost:3000/handle-request", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ 
                request_id: requestId, 
                action: action 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            statusDiv.innerHTML = `<i class="fas fa-${action === 'approve' ? 'check' : 'times'}"></i> ${data.message}`;
            statusDiv.className = action === 'approve' ? "status-success" : "status-error";
            
            // Remove the request card after a delay
            setTimeout(() => {
                requestCard.style.opacity = '0';
                setTimeout(() => requestCard.remove(), 300);
            }, 2000);
            
            showNotification(`Request ${action}ed: ${data.message}`, action === 'approve' ? 'success' : 'warning');
            
            // Update stats
            updateStats();
            loadAvailableTables();
        } else {
            statusDiv.textContent = data.message || "Error processing request";
            statusDiv.className = "status-error";
            
            // Re-enable buttons on error
            buttons.forEach(btn => btn.disabled = false);
        }
    } catch (error) {
        statusDiv.textContent = "Error connecting to server";
        statusDiv.className = "status-error";
        console.error("Request handling error:", error);
        
        // Re-enable buttons on error
        buttons.forEach(btn => btn.disabled = false);
    }
}

// Query Request Handling Functions

// Load pending query requests
async function loadQueryRequests() {
    try {
        const response = await fetch('http://localhost:3000/sender-pending-queries', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        const data = await response.json();
        const requestsList = document.getElementById('queryRequestsList');
        
        if (data.queries && data.queries.length > 0) {
            requestsList.innerHTML = data.queries.map(query => `
                <div class="request-card pending" id="query-request-${query.request_id}">
                    <div class="request-header">
                        <div class="request-info">
                            <h4>📊 Custom Query Request</h4>
                            <div class="request-meta">
                                From: <strong>${query.requested_by}</strong> | 
                                Requested: ${new Date(query.created_at).toLocaleString()}
                            </div>
                        </div>
                        <div class="request-actions">
                            <button class="btn btn-success" onclick="previewQueryResult(${query.request_id})">
                                <i class="fas fa-eye"></i> Preview
                            </button>
                            <button class="btn btn-danger" onclick="rejectQueryRequest(${query.request_id})">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        </div>
                    </div>
                    <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; margin-top: 10px; font-family: monospace; font-size: 0.9rem;">
                        ${query.query}
                    </div>
                    <div class="request-status" id="query-status-${query.request_id}"></div>
                </div>
            `).join('');
        } else {
            requestsList.innerHTML = '<div class="status-info"><i class="fas fa-info-circle"></i> No pending query requests</div>';
        }
    } catch (error) {
        console.error('Error loading query requests:', error);
    }
}

// Preview query result before approval
async function previewQueryResult(requestId) {
    const statusDiv = document.getElementById(`query-status-${requestId}`);
    statusDiv.innerHTML = '<span class="loading"></span> Executing query preview...';
    statusDiv.className = 'status-warning';

    try {
        const response = await fetch('http://localhost:3000/preview-query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ request_id: requestId })
        });

        const data = await response.json();
        
        if (data.success) {
            currentPreviewQuery = { requestId, data: data.result };
            showQueryPreview(data.result, requestId);
            statusDiv.textContent = 'Preview generated';
            statusDiv.className = 'status-success';
        } else {
            statusDiv.textContent = data.message || 'Error generating preview';
            statusDiv.className = 'status-error';
        }
    } catch (error) {
        statusDiv.textContent = 'Error generating preview';
        statusDiv.className = 'status-error';
        console.error('Preview error:', error);
    }
}

// Show query preview modal
function showQueryPreview(result, requestId) {
    const modal = document.getElementById('queryPreviewModal');
    const content = document.getElementById('queryPreviewContent');
    
    const headers = result.headers || Object.keys(result.rows[0] || {});
    const rows = result.rows || [];
    
    content.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div class="status-success">
                <i class="fas fa-check-circle"></i> 
                Query executed successfully. Found ${rows.length} rows.
            </div>
        </div>
        
        <div style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                <thead>
                    <tr style="background: rgba(255,255,255,0.1);">
                        ${headers.map(header => `<th style="padding: 8px; border: 1px solid rgba(255,255,255,0.2); text-align: left;">${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.slice(0, 50).map(row => `
                        <tr>
                            ${headers.map(header => `<td style="padding: 6px; border: 1px solid rgba(255,255,255,0.1);">${row[header] || ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                    ${rows.length > 50 ? `
                        <tr>
                            <td colspan="${headers.length}" style="padding: 8px; text-align: center; background: rgba(255,255,255,0.05);">
                                ... and ${rows.length - 50} more rows
                            </td>
                        </tr>
                    ` : ''}
                </tbody>
            </table>
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn btn-danger" onclick="rejectQueryRequest(${requestId})">
                <i class="fas fa-times"></i> Reject
            </button>
            <button class="btn btn-success" onclick="approveQueryRequest(${requestId})">
                <i class="fas fa-check"></i> Approve & Send
            </button>
        </div>
    `;
    
    modal.style.display = 'block';
}

// Close query preview modal
function closeQueryPreview() {
    document.getElementById('queryPreviewModal').style.display = 'none';
    currentPreviewQuery = null;
}

// Approve query request
async function approveQueryRequest(requestId) {
    const statusDiv = document.getElementById(`query-status-${requestId}`);
    statusDiv.innerHTML = '<span class="loading"></span> Sending data to receiver...';
    statusDiv.className = 'status-warning';

    try {
        const response = await fetch('http://localhost:3000/approve-query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ request_id: requestId })
        });

        const data = await response.json();
        
        if (data.success) {
            statusDiv.innerHTML = '<i class="fas fa-check"></i> Query approved and data sent';
            statusDiv.className = 'status-success';
            closeQueryPreview();
            
            // Remove the request card
            const requestCard = document.getElementById(`query-request-${requestId}`);
            setTimeout(() => {
                requestCard.style.opacity = '0';
                setTimeout(() => requestCard.remove(), 300);
            }, 2000);
            
            showNotification('Query approved and data sent to receiver!', 'success');
        } else {
            statusDiv.textContent = data.message || 'Error approving query';
            statusDiv.className = 'status-error';
        }
    } catch (error) {
        statusDiv.textContent = 'Error approving query';
        statusDiv.className = 'status-error';
        console.error('Approve error:', error);
    }
}

// Reject query request
async function rejectQueryRequest(requestId) {
    const statusDiv = document.getElementById(`query-status-${requestId}`);
    statusDiv.innerHTML = '<span class="loading"></span> Rejecting query...';
    statusDiv.className = 'status-warning';

    try {
        const response = await fetch('http://localhost:3000/reject-query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ request_id: requestId })
        });

        const data = await response.json();
        
        if (data.success) {
            statusDiv.innerHTML = '<i class="fas fa-times"></i> Query rejected';
            statusDiv.className = 'status-error';
            closeQueryPreview();
            
            // Remove the request card
            const requestCard = document.getElementById(`query-request-${requestId}`);
            setTimeout(() => {
                requestCard.style.opacity = '0';
                setTimeout(() => requestCard.remove(), 300);
            }, 2000);
            
            showNotification('Query request rejected', 'warning');
        } else {
            statusDiv.textContent = data.message || 'Error rejecting query';
            statusDiv.className = 'status-error';
        }
    } catch (error) {
        statusDiv.textContent = 'Error rejecting query';
        statusDiv.className = 'status-error';
        console.error('Reject error:', error);
    }
}

// New function to load available tables
async function loadAvailableTables() {
    try {
        const response = await fetch("http://localhost:3000/available-tables", {
            headers: { "Authorization": "Bearer " + token }
        });
        
        const data = await response.json();
        const tablesList = document.getElementById("tablesList");
        
        if (data.tables && data.tables.length > 0) {
            tablesList.innerHTML = `
                <div class="tables-grid">
                    ${data.tables.map(table => `
                        <div class="table-item">
                            <i class="fas fa-table"></i> ${table}
                        </div>
                    `).join('')}
                </div>
                <div class="status-info" style="margin-top: 10px;">
                    <i class="fas fa-info-circle"></i> ${data.tables.length} table(s) available
                </div>
            `;
        } else {
            tablesList.innerHTML = '<div class="status-warning">No tables found in database</div>';
        }
    } catch (error) {
        console.error("Error loading tables:", error);
        document.getElementById("tablesList").innerHTML = '<div class="status-error">Error loading tables</div>';
    }
}

// New function to update statistics
async function updateStats(stats = null) {
    try {
        if (!stats) {
            const response = await fetch("http://localhost:3000/sender-stats", {
                headers: { "Authorization": "Bearer " + token }
            });
            const data = await response.json();
            stats = data.stats;
        }
        
        if (stats) {
            document.getElementById("totalReceived").textContent = stats.total || 0;
            document.getElementById("approvedCount").textContent = stats.approved || 0;
            document.getElementById("pendingCount").textContent = stats.pending || 0;
            document.getElementById("rejectedCount").textContent = stats.rejected || 0;
        }
    } catch (error) {
        console.error("Error loading stats:", error);
    }
}

// Update polling to include query requests
async function checkForRequests() {
    try {
        // Check for table requests
        const tableResponse = await fetch("http://localhost:3000/sender-requests", {
            headers: { "Authorization": "Bearer " + token }
        });
        
        const tableData = await tableResponse.json();
        
        if (tableData.requests && tableData.requests.length > 0) {
            displayRequests(tableData.requests);
            updateStats(tableData.stats);
        } else {
            document.getElementById("requestsList").innerHTML = `
                <div class="status-info">
                    <i class="fas fa-info-circle"></i> No pending requests at the moment
                </div>
            `;
        }

        // Check for query requests
        await loadQueryRequests();
        
    } catch (error) {
        console.error("Error checking requests:", error);
    }
}

// New function to refresh data
function refreshData() {
    showNotification("Refreshing data...", 'success');
    checkForRequests();
    loadAvailableTables();
    updateStats();
}

// Enhanced logout function
function logout() {
    token = null;
    currentUser = null;
    
    // Clear polling interval
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    
    document.getElementById("panel").style.display = "none";
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("username").value = '';
    document.getElementById("password").value = '';
    document.getElementById("loginStatus").textContent = '';
    
    showNotification("Logged out successfully", 'success');
}

// Add auto-logout after 30 minutes of inactivity
let inactivityTimer;
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        if (token) {
            showNotification("Session expired due to inactivity", 'warning');
            logout();
        }
    }, 30 * 60 * 1000); // 30 minutes
}

// Reset timer on user activity
document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('keypress', resetInactivityTimer);
resetInactivityTimer();