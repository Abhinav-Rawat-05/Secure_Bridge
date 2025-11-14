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

// Load approved queries - FIXED FOR EMPTY RESULTS
async function loadApprovedQueries() {
    try {
        const response = await fetch('http://localhost:3000/approved-queries', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.queries && data.queries.length > 0) {
            document.getElementById('queryResultsSection').style.display = 'block';
            document.getElementById('receivedQueriesList').innerHTML = data.queries.map(query => {
                // Parse the result data and headers
                let resultData = [];
                let headers = [];
                let rowCount = 0;
                
                try {
                    if (query.result_data) {
                        resultData = JSON.parse(query.result_data);
                        rowCount = resultData.length;
                    }
                    if (query.result_headers) {
                        headers = JSON.parse(query.result_headers);
                    }
                } catch (e) {
                    console.error('Error parsing query result:', e);
                    resultData = [];
                    headers = [];
                }
                
                return `
                    <div class="query-result-card">
                        <div class="query-result-header">
                            <div>
                                <strong>Query Result #${query.request_id}</strong>
                                <div class="query-result-meta">
                                    Received: ${new Date(query.updated_at).toLocaleString()} | 
                                    Rows: ${rowCount} | 
                                    Table: <strong>${query.table_name || 'Not saved'}</strong>
                                </div>
                            </div>
                            <span class="badge badge-approved">Approved & Saved</span>
                        </div>
                        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; font-family: monospace; font-size: 0.9rem; margin-bottom: 10px;">
                            ${query.query}
                        </div>
                        
                        <!-- Status Message -->
                        ${rowCount === 0 ? `
                            <div class="status-info">
                                <i class="fas fa-info-circle"></-> Query executed successfully.
                            </div>
                        ` : ''}
                        
                        <!-- Preview Table -->
                        ${resultData.length > 0 ? `
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
                                                `<td style="padding: 4px; border: 1px solid rgba(255,255,255,0.1);">${row[header] !== null && row[header] !== undefined ? row[header] : ''}</td>`
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
                        ` : ''}
                        
                        <div class="query-actions">
                            ${query.table_name ? `
                            <button class="btn btn-success" onclick="viewSavedTable('${query.table_name}')">
                                <i class="fas fa-eye"></i> View Table Structure
                            </button>
                            <button class="btn btn-primary" onclick="runQueryOnTable('${query.table_name}')">
                                <i class="fas fa-search"></i> Query This Table
                            </button>
                            ` : `
                            <div class="status-warning">
                                <i class="fas fa-exclamation-triangle"></i> Table saved
                            </div>
                            `}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            document.getElementById('queryResultsSection').innerHTML = `
                <div class="status-info">
                    <i class="fas fa-info-circle"></i> No query results received yet. Send a query request and wait for sender approval.
                </div>
            `;
            document.getElementById('queryResultsSection').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading approved queries:', error);
        document.getElementById('queryResultsSection').innerHTML = `
            <div class="status-error">
                <i class="fas fa-exclamation-triangle"></i> Error loading query results: ${error.message}
            </div>
        `;
        document.getElementById('queryResultsSection').style.display = 'block';
    }
}

// View saved table
function viewSavedTable(tableName) {
    document.getElementById('queryBox').value = `SELECT * FROM ${tableName} LIMIT 50;`;
    showNotification(`Query loaded for table '${tableName}'`, 'success');
}

// Run query on saved table
function runQueryOnTable(tableName) {
    document.getElementById('queryBox').value = `SELECT * FROM ${tableName} WHERE ...;`;
    document.getElementById('queryBox').focus();
    showNotification(`Ready to query table '${tableName}'. Modify the WHERE clause as needed.`, 'success');
}

// Update dashboard to include query features
async function loadDashboard() {
    await loadRequestHistory();
    await updateStats();
    await loadPendingQueries();
    await loadApprovedQueries();
    
    // Start polling for new query results
    startQueryPolling();
}

// Start polling for query updates
let queryPollingInterval = null;
function startQueryPolling() {
    // Clear any existing interval
    if (queryPollingInterval) {
        clearInterval(queryPollingInterval);
    }
    
    // Set up polling every 3 seconds for query updates
    queryPollingInterval = setInterval(async () => {
        await loadPendingQueries();
        await loadApprovedQueries();
    }, 3000);
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
    
    // Clear polling intervals
    if (queryPollingInterval) {
        clearInterval(queryPollingInterval);
        queryPollingInterval = null;
    }
    
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

// Toggle request type options
function toggleRequestType() {
    const requestType = document.getElementById('requestType').value;
    const downloadOptions = document.getElementById('downloadOptions');
    
    if (requestType === 'download') {
        downloadOptions.style.display = 'block';
    } else {
        downloadOptions.style.display = 'none';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize any default settings
    toggleRequestType();
});