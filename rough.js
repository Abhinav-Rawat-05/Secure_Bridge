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



















________________________________________________________________





let token = null;
let currentUser = null;
let senderTables = [];

// Notification system
function showNotification(message, type = 'success') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i>
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
        
        if (data.token && data.role === "receiver") {
            token = data.token;
            currentUser = username;
            document.getElementById("loginBox").style.display = "none";
            document.getElementById("panel").style.display = "block";
            showNotification("Login successful! Welcome to Receiver Dashboard.", 'success');
            await loadDashboard();
        } else {
            loginStatus.textContent = data.message || "Login failed";
            loginStatus.className = "status-error";
        }
    } catch (error) {
        loginStatus.textContent = "Error connecting to server";
        loginStatus.className = "status-error";
        console.error("Login error:", error);
    }
}

// Enhanced request function
async function sendRequest() {
    const senderId = document.getElementById("senderId").value.trim();
    const table = document.getElementById("tableName").value.trim();
    const statusDiv = document.getElementById("status");

    if (!senderId || !table) {
        showNotification("Please enter both Sender ID and Table Name", 'error');
        return;
    }

    statusDiv.innerHTML = '<span class="loading"></span> Sending request...';
    statusDiv.className = "status-warning";

    try {
        const response = await fetch("http://localhost:3000/request-table", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ sender_id: senderId, table })
        });
        
        const data = await response.json();
        statusDiv.textContent = data.message;
        statusDiv.className = data.message.includes("Error") ? "status-error" : "status-success";
        
        if (!data.message.includes("Error")) {
            showNotification(`Request sent for table '${table}'`, 'success');
            document.getElementById("senderId").value = '';
            document.getElementById("tableName").value = '';
            await loadRequestHistory();
            await updateStats();
        }
    } catch (error) {
        statusDiv.textContent = "Error connecting to server";
        statusDiv.className = "status-error";
        console.error("Request error:", error);
    }
}

// Enhanced query function
async function runQuery() {
    const query = document.getElementById("queryBox").value.trim();
    const table = document.getElementById("queryTable");
    const messageDiv = document.getElementById("queryMessage");
    const outputDiv = document.getElementById("queryOutput");
    const resultStats = document.getElementById("resultStats");

    if (!query) {
        showNotification("Please enter a SQL query first", 'error');
        return;
    }

    table.innerHTML = "";
    messageDiv.innerHTML = '<span class="loading"></span> Running query...';
    messageDiv.className = "status-warning";
    outputDiv.style.display = 'none';

    try {
        const response = await fetch("http://localhost:3000/run-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });
        
        const data = await response.json();
        
        if (data.rows && data.rows.length > 0) {
            messageDiv.textContent = data.message || "Query executed successfully";
            messageDiv.className = "status-success";
            outputDiv.style.display = 'block';

            // Create table header
            const headers = Object.keys(data.rows[0]);
            const thead = `<tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>`;

            // Create table body
            const rows = data.rows.map(row => {
                const cells = headers.map(h => `<td>${row[h]}</td>`).join("");
                return `<tr>${cells}</tr>`;
            }).join("");

            table.innerHTML = thead + rows;
            
            // Show result statistics
            resultStats.textContent = `Found ${data.rows.length} row(s)`;
            resultStats.className = "status-success";
            
            showNotification(`Query executed successfully. Found ${data.rows.length} rows.`, 'success');
        } 
        else if (data.rows && data.rows.length === 0) {
            messageDiv.textContent = "✅ Query executed successfully. No rows found.";
            messageDiv.className = "status-warning";
            showNotification("Query executed but no data found", 'warning');
        }
        else {
            messageDiv.textContent = data.message || "Query executed";
            messageDiv.className = data.message.includes("Error") ? "status-error" : "status-success";
        }
    } catch (error) {
        messageDiv.textContent = "⚠️ Connection error. Please check if server is running.";
        messageDiv.className = "status-error";
        console.error("Query error:", error);
    }
}

// New function to clear query
function clearQuery() {
    document.getElementById("queryBox").value = '';
    document.getElementById("queryOutput").style.display = 'none';
    document.getElementById("queryMessage").textContent = '';
    showNotification("Query cleared", 'success');
}

// New function to show query examples
function showExamples() {
    const examples = [
        "SELECT * FROM patients;",
        "SELECT name, age FROM patients WHERE age > 30;",
        "SELECT * FROM employees ORDER BY join_date DESC;",
        "SELECT department, COUNT(*) as count FROM employees GROUP BY department;"
    ];
    
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    document.getElementById("queryBox").value = randomExample;
    showNotification("Example query loaded. Feel free to modify it!", 'success');
}

// New function to load request history
async function loadRequestHistory() {
    try {
        const response = await fetch("http://localhost:3000/request-history", {
            headers: { "Authorization": "Bearer " + token }
        });
        
        const data = await response.json();
        const historyList = document.getElementById("historyList");
        
        if (data.history && data.history.length > 0) {
            historyList.innerHTML = data.history.map(item => `
                <div class="history-item">
                    <div>
                        <strong>${item.table_name}</strong> from ${item.sender_id}
                        <br><small>${new Date(item.created_at).toLocaleString()}</small>
                    </div>
                    <span class="history-status status-${item.status.toLowerCase()}">
                        ${item.status}
                    </span>
                </div>
            `).join('');
        } else {
            historyList.innerHTML = '<div class="status-message">No request history found</div>';
        }
    } catch (error) {
        console.error("Error loading history:", error);
    }
}

// New function to update statistics
async function updateStats() {
    try {
        const response = await fetch("http://localhost:3000/request-stats", {
            headers: { "Authorization": "Bearer " + token }
        });
        
        const data = await response.json();
        
        if (data.stats) {
            document.getElementById("totalRequests").textContent = data.stats.total;
            document.getElementById("approvedRequests").textContent = data.stats.approved;
            document.getElementById("pendingRequests").textContent = data.stats.pending;
        }
    } catch (error) {
        console.error("Error loading stats:", error);
    }
}

// Query-Based Data Sharing Functions

// Load available tables from sender database
async function loadSenderTables() {
    const tablesList = document.getElementById('tablesList');
    tablesList.innerHTML = '<div class="status-warning"><span class="loading"></span> Loading tables...</div>';

    try {
        const response = await fetch('http://localhost:3000/sender-tables', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        const data = await response.json();
        
        if (data.tables && data.tables.length > 0) {
            senderTables = data.tables;
            tablesList.innerHTML = data.tables.map(table => `
                <div class="table-item" onclick="useTableInQuery('${table.Tables_in_sender_db}')">
                    <div class="table-name">${table.Tables_in_sender_db}</div>
                    <div class="table-info">Click to use in query</div>
                </div>
            `).join('');
        } else {
            tablesList.innerHTML = '<div class="status-error">No tables found</div>';
        }
    } catch (error) {
        tablesList.innerHTML = '<div class="status-error">Error loading tables</div>';
        console.error('Error loading tables:', error);
    }
}

// Auto-fill query when table is clicked
function useTableInQuery(tableName) {
    const queryTextarea = document.getElementById('customQuery');
    const currentQuery = queryTextarea.value.trim();
    
    if (currentQuery === '' || currentQuery.endsWith(';')) {
        queryTextarea.value = `SELECT * FROM ${tableName} LIMIT 100;`;
    } else {
        queryTextarea.value += `\nSELECT * FROM ${tableName} LIMIT 100;`;
    }
    
    queryTextarea.focus();
    showNotification(`Table "${tableName}" added to query`, 'success');
}

// Send query request to sender for approval
async function sendQueryRequest() {
    const query = document.getElementById('customQuery').value.trim();
    const limitResults = document.getElementById('limitResults').checked;
    const statusDiv = document.getElementById('queryRequestStatus');

    if (!query) {
        showNotification('Please enter a SQL query', 'error');
        return;
    }

    // Basic SQL validation
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('drop ') || lowerQuery.includes('delete ') || 
        lowerQuery.includes('truncate ') || lowerQuery.includes('alter ') ||
        lowerQuery.includes('insert ') || lowerQuery.includes('update ')) {
        showNotification('Only SELECT queries are allowed for security', 'error');
        return;
    }

    statusDiv.innerHTML = '<span class="loading"></span> Sending query for approval...';
    statusDiv.className = 'status-warning';

    try {
        const response = await fetch('http://localhost:3000/query-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                query: query,
                limit_results: limitResults,
                requested_by: currentUser
            })
        });

        const data = await response.json();
        
        if (data.success) {
            statusDiv.textContent = '✅ Query sent for approval. Waiting for sender response.';
            statusDiv.className = 'status-success';
            document.getElementById('customQuery').value = '';
            showNotification('Query sent for approval!', 'success');
            loadPendingQueries();
        } else {
            statusDiv.textContent = data.message || 'Error sending query';
            statusDiv.className = 'status-error';
        }
    } catch (error) {
        statusDiv.textContent = 'Error connecting to server';
        statusDiv.className = 'status-error';
        console.error('Query request error:', error);
    }
}

// Load pending query requests
async function loadPendingQueries() {
    try {
        const response = await fetch('http://localhost:3000/pending-queries', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        const data = await response.json();
        
        if (data.queries && data.queries.length > 0) {
            document.getElementById('pendingQueriesSection').style.display = 'block';
            document.getElementById('pendingQueriesList').innerHTML = data.queries.map(query => `
                <div class="query-result-card">
                    <div class="query-result-header">
                        <div>
                            <strong>Query Request</strong>
                            <div class="query-result-meta">
                                Sent: ${new Date(query.created_at).toLocaleString()}
                            </div>
                        </div>
                        <span class="badge badge-pending">Pending Approval</span>
                    </div>
                    <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; font-family: monospace; font-size: 0.9rem;">
                        ${query.query}
                    </div>
                </div>
            `).join('');
        } else {
            document.getElementById('pendingQueriesSection').style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading pending queries:', error);
    }
}

// Load approved queries
async function loadApprovedQueries() {
    try {
        const response = await fetch('http://localhost:3000/approved-queries', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        const data = await response.json();
        
        if (data.queries && data.queries.length > 0) {
            document.getElementById('queryResultsSection').style.display = 'block';
            document.getElementById('receivedQueriesList').innerHTML = data.queries.map(query => {
                const resultData = JSON.parse(query.result_data || '[]');
                const headers = JSON.parse(query.result_headers || '[]');
                
                return `
                    <div class="query-result-card">
                        <div class="query-result-header">
                            <div>
                                <strong>Query Result</strong>
                                <div class="query-result-meta">
                                    Received: ${new Date(query.updated_at).toLocaleString()} | 
                                    Rows: ${resultData.length} | 
                                    Columns: ${headers.length}
                                </div>
                            </div>
                            <span class="badge badge-approved">Approved</span>
                        </div>
                        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; font-family: monospace; font-size: 0.9rem; margin-bottom: 10px;">
                            ${query.query}
                        </div>
                        
                        <!-- Preview Table -->
                        <div style="max-height: 300px; overflow-y: auto; margin-bottom: 15px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                                <thead>
                                    <tr style="background: rgba(255,255,255,0.1);">
                                        ${headers.slice(0, 5).map(header => 
                                            `<th style="padding: 6px; border: 1px solid rgba(255,255,255,0.2); text-align: left;">${header}</th>`
                                        ).join('')}
                                        ${headers.length > 5 ? `<th style="padding: 6px; border: 1px solid rgba(255,255,255,0.2);">...</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${resultData.slice(0, 5).map(row => `
                                        <tr>
                                            ${headers.slice(0, 5).map(header => 
                                                `<td style="padding: 4px; border: 1px solid rgba(255,255,255,0.1);">${row[header] || ''}</td>`
                                            ).join('')}
                                            ${headers.length > 5 ? `<td style="padding: 4px; border: 1px solid rgba(255,255,255,0.1);">...</td>` : ''}
                                        </tr>
                                    `).join('')}
                                    ${resultData.length > 5 ? `
                                        <tr>
                                            <td colspan="${Math.min(headers.length, 6)}" style="padding: 6px; text-align: center; background: rgba(255,255,255,0.05);">
                                                ... and ${resultData.length - 5} more rows
                                            </td>
                                        </tr>
                                    ` : ''}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="query-actions">
                            <button class="download-btn" onclick="downloadQueryResult(${query.request_id})">
                                <i class="fas fa-download"></i> Download CSV
                            </button>
                            <button class="save-btn" onclick="saveQueryAsTable(${query.request_id})">
                                <i class="fas fa-save"></i> Save as Table
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            document.getElementById('queryResultsSection').style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading approved queries:', error);
    }
}

// Download query result as CSV
async function downloadQueryResult(requestId) {
    try {
        const response = await fetch(`http://localhost:3000/download-query-csv/${requestId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `query_result_${requestId}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showNotification('CSV download started!', 'success');
        } else {
            showNotification('Error downloading CSV', 'error');
        }
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Error downloading file', 'error');
    }
}

// Save query result as table
async function saveQueryAsTable(requestId) {
    const tableName = prompt('Enter a name for the new table:');
    
    if (!tableName) {
        return;
    }

    // Validate table name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        showNotification('Invalid table name. Use only letters, numbers, and underscores.', 'error');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/save-query-as-table', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                request_id: requestId,
                table_name: tableName
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message, 'success');
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Save error:', error);
        showNotification('Error saving table', 'error');
    }
}

// Update dashboard to include query features
async function loadDashboard() {
    await loadRequestHistory();
    await updateStats();
    await loadPendingQueries();
    await loadApprovedQueries();
}

// New function to refresh dashboard
function refreshDashboard() {
    showNotification("Refreshing dashboard...", 'success');
    loadDashboard();
}

// Enhanced logout function
function logout() {
    token = null;
    currentUser = null;
    document.getElementById("panel").style.display = "none";
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("username").value = '';
    document.getElementById("password").value = '';
    document.getElementById("loginStatus").textContent = '';
    showNotification("Logged out successfully", 'success');
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl + Enter to run query
    if (event.ctrlKey && event.key === 'Enter') {
        if (document.getElementById("queryBox").value.trim()) {
            runQuery();
        }
    }
    
    // Escape to clear query
    if (event.key === 'Escape') {
        clearQuery();
    }
});

// Add input validation
document.getElementById('queryBox').addEventListener('input', function() {
    const query = this.value.trim();
    if (query.toLowerCase().includes('drop table') || query.toLowerCase().includes('delete from')) {
        showNotification("Warning: This query contains potentially dangerous operations!", 'error');
    }
});

-----------------------------------------------------------------------














<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receiver Panel | Secure DB Proxy</title>
  <link rel="stylesheet" href="receiver.css">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>
<body>
  <div class="container">
    <h1>📥 Receiver Dashboard</h1>

    <!-- 🔐 Login Section -->
    <div id="loginBox">
      <div class="card">
        <h3><i class="fas fa-lock"></i> Secure Login</h3>
        <div class="input-group">
          <label for="username"><i class="fas fa-user"></i> Username</label>
          <input type="text" id="username" placeholder="Enter your username">
        </div>
        <div class="input-group">
          <label for="password"><i class="fas fa-key"></i> Password</label>
          <input type="password" id="password" placeholder="Enter your password">
        </div>
        <button class="btn btn-primary" onclick="login()">
          <i class="fas fa-sign-in-alt"></i> Login
        </button>
        <div id="loginStatus" class="status-message"></div>
      </div>
    </div>

    <!-- 🎯 Main Panel -->
    <div id="panel" style="display:none;">
      <!-- Stats Overview -->
      <div class="stats-container">
        <div class="stat-card">
          <div class="stat-number" id="totalRequests">0</div>
          <div class="stat-label">Total Requests</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" id="approvedRequests">0</div>
          <div class="stat-label">Approved</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" id="pendingRequests">0</div>
          <div class="stat-label">Pending</div>
        </div>
      </div>

      <!-- 📋 Request Table Section -->
      <div class="card">
        <h3><i class="fas fa-table"></i> Request Data Table</h3>
        <div class="input-group">
          <label for="senderId"><i class="fas fa-hospital"></i> Sender ID</label>
          <input type="text" id="senderId" placeholder="Enter Sender ID (e.g., HOSPITAL_A)">
        </div>
        <div class="input-group">
          <label for="tableName"><i class="fas fa-database"></i> Table Name</label>
          <input type="text" id="tableName" placeholder="Enter Table Name">
        </div>
        <button class="btn btn-primary" onclick="sendRequest()">
          <i class="fas fa-paper-plane"></i> Send Request
        </button>
        <div id="status" class="status-message"></div>
      </div>

      <!-- 🔍 Advanced Query Request Section -->
      <div class="card">
        <h3><i class="fas fa-code"></i> Advanced Query Request</h3>
        
        <!-- Database Explorer -->
        <div class="input-group">
          <label><i class="fas fa-database"></i> Explore Sender Database</label>
          <button class="btn btn-secondary" onclick="loadSenderTables()">
            <i class="fas fa-sync"></i> Load Available Tables
          </button>
          <div id="tablesList" class="tables-container"></div>
        </div>

        <!-- Query Builder -->
        <div class="input-group">
          <label for="customQuery"><i class="fas fa-terminal"></i> Custom SQL Query</label>
          <textarea id="customQuery" rows="4" placeholder="SELECT * FROM patients WHERE age > 30;
SELECT name, department FROM employees;
-- Write your query here..."></textarea>
          <div class="query-helper">
            <small>💡 You can query: patients, employees, appointments, medical_records, etc.</small>
          </div>
        </div>

        <!-- Query Preview Options -->
        <div class="input-group">
          <label>Query Options</label>
          <div class="options-group">
            <label>
              <input type="checkbox" id="limitResults" checked> Limit to 100 rows
            </label>
            <label>
              <input type="checkbox" id="includeHeaders" checked> Include column headers
            </label>
          </div>
        </div>

        <button class="btn btn-primary" onclick="sendQueryRequest()">
          <i class="fas fa-paper-plane"></i> Send Query for Approval
        </button>
        
        <div id="queryRequestStatus" class="status-message"></div>
      </div>

      <!-- ⏳ Pending Query Requests Section -->
      <div class="card" id="pendingQueriesSection" style="display: none;">
        <h3><i class="fas fa-clock"></i> Pending Query Requests</h3>
        <div id="pendingQueriesList"></div>
      </div>

      <!-- 📥 Received Query Results Section -->
      <div class="card" id="queryResultsSection" style="display: none;">
        <h3><i class="fas fa-download"></i> Received Query Results</h3>
        <div id="receivedQueriesList"></div>
      </div>

      <!-- 🧠 SQL Query Section -->
      <div class="query-section">
        <h3><i class="fas fa-search"></i> SQL Query Interface</h3>
        <textarea id="queryBox" placeholder="Example: SELECT * FROM patients WHERE age > 30;
Example: SELECT name, department FROM employees ORDER BY join_date DESC;"></textarea>
        <div class="button-group">
          <button class="btn btn-success" onclick="runQuery()">
            <i class="fas fa-play"></i> Execute Query
          </button>
          <button class="btn btn-secondary" onclick="clearQuery()">
            <i class="fas fa-eraser"></i> Clear
          </button>
          <button class="btn btn-secondary" onclick="showExamples()">
            <i class="fas fa-lightbulb"></i> Examples
          </button>
        </div>

        <!-- 📊 Query Results -->
        <div id="queryOutput" style="display:none;">
          <h4><i class="fas fa-table"></i> Query Results</h4>
          <div class="table-container">
            <table id="queryTable"></table>
          </div>
          <div id="resultStats" class="status-message"></div>
        </div>

        <!-- 💬 Query Message -->
        <div id="queryMessage" class="status-message"></div>
      </div>

      <!-- 📜 Request History -->
      <div class="card request-history">
        <h3><i class="fas fa-history"></i> Request History</h3>
        <div id="historyList"></div>
      </div>

      <!-- 🚪 Logout -->
      <div class="button-group">
        <button class="btn btn-danger" onclick="logout()">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
        <button class="btn btn-secondary" onclick="refreshDashboard()">
          <i class="fas fa-sync-alt"></i> Refresh
        </button>
      </div>
    </div>
  </div>

  <!-- 🔔 Notification Container -->
  <div id="notificationContainer"></div>

  <script src="receiver.js"></script>
</body>
</html>








---------------------------------------------










<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sender Panel | Secure DB Proxy</title>
  <link rel="stylesheet" href="sender.css">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>
<body>
  <div class="container">
    <h2>📤 Sender Dashboard</h2>

    <!-- 🔐 Login Section -->
    <div id="loginBox">
      <h3><i class="fas fa-lock"></i> Sender Login</h3>
      <div class="input-group">
        <label for="username"><i class="fas fa-user"></i> Username</label>
        <input type="text" id="username" placeholder="Enter your username">
      </div>
      <div class="input-group">
        <label for="password"><i class="fas fa-key"></i> Password</label>
        <input type="password" id="password" placeholder="Enter your password">
      </div>
      <button class="btn btn-primary" onclick="login()">
        <i class="fas fa-sign-in-alt"></i> Login as Sender
      </button>
      <div id="loginStatus" class="status-message"></div>
    </div>

    <!-- 🎯 Main Panel -->
    <div id="panel" style="display:none;">
      <!-- Stats Overview -->
      <div class="stats-container">
        <div class="stat-card">
          <div class="stat-number" id="totalReceived">0</div>
          <div class="stat-label">Requests Received</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" id="approvedCount">0</div>
          <div class="stat-label">Approved</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" id="pendingCount">0</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" id="rejectedCount">0</div>
          <div class="stat-label">Rejected</div>
        </div>
      </div>

      <!-- 📋 Active Data Requests -->
      <div class="card">
        <h3><i class="fas fa-bell"></i> Active Data Requests</h3>
        <div id="requestsList">
          <div class="status-info">
            <i class="fas fa-info-circle"></i> Waiting for receiver requests...
          </div>
        </div>
        <div id="requestStatus" class="status-message"></div>
      </div>

      <!-- 🔍 Pending Query Requests -->
      <div class="card">
        <h3><i class="fas fa-search"></i> Pending Query Requests</h3>
        <div id="queryRequestsList">
          <div class="status-info">
            <i class="fas fa-info-circle"></i> No pending query requests
          </div>
        </div>
      </div>

      <!-- 📊 Available Tables -->
      <div class="card">
        <h3><i class="fas fa-database"></i> Available Tables</h3>
        <div id="tablesList" class="status-message">
          <span class="loading"></span> Loading available tables...
        </div>
      </div>

      <!-- 🚪 Logout -->
      <div style="text-align: center; margin-top: 25px;">
        <button class="btn btn-danger" onclick="logout()">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
        <button class="btn btn-primary" onclick="refreshData()">
          <i class="fas fa-sync-alt"></i> Refresh
        </button>
      </div>
    </div>
  </div>

  <!-- 🔔 Notification Container -->
  <div id="notificationContainer"></div>

  <!-- 🔍 Query Preview Modal -->
  <div id="queryPreviewModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3><i class="fas fa-eye"></i> Query Result Preview</h3>
        <button class="close-modal" onclick="closeQueryPreview()">&times;</button>
      </div>
      <div id="queryPreviewContent">
        <!-- Preview content will be loaded here -->
      </div>
    </div>
  </div>

  <script src="sender.js"></script>
</body>
</html>