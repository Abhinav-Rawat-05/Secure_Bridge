import express from "express";
import mysql from "mysql2";
import bodyParser from "body-parser";
import cors from "cors";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
app.use(cors());
app.use(bodyParser.json());

/* ------------------- DATABASE CONNECTIONS ------------------- */
const senderDB = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "hello",
  database: "sender_db",
});

const receiverDB = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "hello",
  database: "receiver_db",
});

senderDB.connect(err => {
  if (err) console.error("❌ Sender DB Error:", err);
  else console.log("✅ Connected to Sender DB");
});
receiverDB.connect(err => {
  if (err) console.error("❌ Receiver DB Error:", err);
  else console.log("✅ Connected to Receiver DB");
});

/* ------------------- DATABASE INITIALIZATION ------------------- */
function initializeDatabase() {
    console.log('🔄 Initializing database tables...');
    
    const tables = [
        {
            name: 'query_requests',
            query: `
                CREATE TABLE IF NOT EXISTS query_requests (
                    request_id INT AUTO_INCREMENT PRIMARY KEY,
                    query TEXT NOT NULL,
                    requested_by VARCHAR(100),
                    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                    result_data JSON,
                    result_headers JSON,
                    table_name VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `
        },
        {
            name: 'received_log', 
            query: `
                CREATE TABLE IF NOT EXISTS received_log (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    sender_id VARCHAR(100),
                    table_name VARCHAR(100),
                    status VARCHAR(100) DEFAULT 'Pending',
                    payload_hash VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `
        },
        {
            name: 'auth_users',
            query: `
                CREATE TABLE IF NOT EXISTS auth_users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role ENUM('sender', 'receiver') NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `
        }
    ];

    tables.forEach(table => {
        receiverDB.query(table.query, (err) => {
            if (err) {
                console.error(`❌ Error initializing ${table.name} table:`, err);
            } else {
                console.log(`✅ ${table.name} table initialized`);
            }
        });
    });
}

// Initialize when server starts
setTimeout(initializeDatabase, 1000);

/* ------------------- CONSTANTS ------------------- */
const LEGIT_SENDER_ID = "HOSPITAL_A";
const SECRET_KEY = "very_strong_secret_here_change_in_production!";

/* ------------------- AUTHENTICATION ------------------- */
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "Missing username or password" });

  receiverDB.query("SELECT * FROM auth_users WHERE username = ?", [username], async (err, rows) => {
    if (err) return res.json({ message: "Database error" });
    if (rows.length === 0) return res.json({ message: "User not found" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.json({ message: "Invalid password" });

    const token = jwt.sign({ username: user.username, role: user.role }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ message: "Login successful", token, role: user.role });
  });
});

// Middleware to verify token
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = decoded;
    next();
  });
}

/* ------------------- RECEIVER ENDPOINTS ------------------- */

// Request table from sender
app.post("/request-table", verifyToken, (req, res) => {
  if (req.user.role !== "receiver")
    return res.status(403).json({ message: "Only receiver can request data" });

  const { sender_id, table } = req.body;
  if (!sender_id || !table)
    return res.json({ message: "Missing sender_id or table name" });

  receiverDB.query(
    "INSERT INTO received_log (sender_id, table_name, status) VALUES (?, ?, 'Pending')",
    [sender_id, table],
    (err, result) => {
      if (err) return res.json({ message: "DB Error: " + err });
      res.json({ 
        message: `✅ Request sent for table '${table}' from sender '${sender_id}'`,
        requestId: result.insertId
      });
    }
  );
});

// Get request history for receiver
app.get("/request-history", verifyToken, (req, res) => {
  if (req.user.role !== "receiver")
    return res.status(403).json({ message: "Access denied" });

  receiverDB.query(
    "SELECT * FROM received_log ORDER BY created_at DESC LIMIT 10",
    (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
      res.json({ history: results });
    }
  );
});

// Get request statistics for receiver
app.get("/request-stats", verifyToken, (req, res) => {
  if (req.user.role !== "receiver")
    return res.status(403).json({ message: "Access denied" });

  receiverDB.query(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = '✅ Received' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending
    FROM received_log`,
    (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
      res.json({ stats: results[0] });
    }
  );
});

/* ------------------- SENDER ENDPOINTS ------------------- */

// Get pending requests for sender
app.get("/sender-requests", verifyToken, (req, res) => {
  if (req.user.role !== "sender")
    return res.status(403).json({ message: "Only sender can access requests" });

  receiverDB.query(
    "SELECT * FROM received_log WHERE status = 'Pending' ORDER BY created_at DESC",
    (err, requests) => {
      if (err) return res.status(500).json({ message: "Database error" });

      // Get stats
      receiverDB.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = '✅ Received' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status LIKE 'Rejected%' THEN 1 ELSE 0 END) as rejected
        FROM received_log`,
        (errStats, statsResults) => {
          if (errStats) return res.json({ requests, stats: {} });
          res.json({ 
            requests, 
            stats: statsResults[0] 
          });
        }
      );
    }
  );
});

// Handle request (approve/reject)
app.post("/handle-request", verifyToken, (req, res) => {
  if (req.user.role !== "sender")
    return res.status(403).json({ message: "Only sender can handle requests" });

  const { request_id, action } = req.body;
  if (!request_id || !action)
    return res.status(400).json({ message: "Missing request_id or action" });

  // Get the request details
  receiverDB.query(
    "SELECT * FROM received_log WHERE id = ?",
    [request_id],
    (err, results) => {
      if (err || results.length === 0)
        return res.json({ success: false, message: "Request not found" });

      const request = results[0];

      if (action === 'reject') {
        receiverDB.query(
          "UPDATE received_log SET status = 'Rejected by sender' WHERE id = ?",
          [request_id],
          (err) => {
            if (err) return res.json({ success: false, message: "Database error" });
            res.json({ success: true, message: "Request rejected successfully" });
          }
        );
      } else if (action === 'approve') {
        // Process the approved request
        processDataTransfer(request, res);
      } else {
        res.json({ success: false, message: "Invalid action" });
      }
    }
  );
});

// Process data transfer for approved requests
function processDataTransfer(request, res) {
  const { id, sender_id, table_name } = request;

  if (sender_id !== LEGIT_SENDER_ID) {
    receiverDB.query(
      "UPDATE received_log SET status = ? WHERE id = ?",
      ["Rejected: Invalid Sender", id]
    );
    return res.json({ success: false, message: "❌ Invalid sender ID" });
  }

  senderDB.query(`SHOW TABLES LIKE ?`, [table_name], (errT, rows) => {
    if (errT || rows.length === 0) {
      receiverDB.query(
        "UPDATE received_log SET status = ? WHERE id = ?",
        ["saved", id]
      );
      return res.json({ success: false, message: "❌ Table not found in sender DB" });
    }

    senderDB.query(`SELECT * FROM \`${table_name}\``, async (err2, data) => {
      if (err2) {
        receiverDB.query(
          "UPDATE received_log SET status = ? WHERE id = ?",
          ["Rejected: Error reading table", id]
        );
        return res.json({ success: false, message: "❌ Error reading sender table" });
      }

      const hash = crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");

      // Drop and recreate table in receiver DB
      receiverDB.query(`DROP TABLE IF EXISTS \`${table_name}\``);
      senderDB.query(`SHOW CREATE TABLE \`${table_name}\``, (err3, structure) => {
        if (err3) {
          receiverDB.query(
            "UPDATE received_log SET status = ? WHERE id = ?",
            ["Rejected: Error getting schema", id]
          );
          return res.json({ success: false, message: "❌ Error getting table schema" });
        }

        const createSQL = structure[0]["Create Table"];
        receiverDB.query(createSQL, (err4) => {
          if (err4) {
            receiverDB.query(
              "UPDATE received_log SET status = ? WHERE id = ?",
              ["Rejected: Error creating table", id]
            );
            return res.json({ success: false, message: "❌ Error creating receiver table" });
          }

          // Insert data
          let inserted = 0;
          data.forEach(row => {
            const cols = Object.values(row).map(v => mysql.escape(v)).join(",");
            receiverDB.query(`INSERT INTO \`${table_name}\` VALUES (${cols})`, (err5) => {
              if (!err5) inserted++;
            });
          });

          receiverDB.query(
            "UPDATE received_log SET status = '✅ Received', payload_hash = ? WHERE id = ?",
            [hash, id]
          );

          res.json({ 
            success: true, 
            message: `✅ Transferred '${table_name}' successfully. ${inserted} rows inserted.` 
          });
        });
      });
    });
  });
}

// Get available tables for sender
app.get("/available-tables", verifyToken, (req, res) => {
  if (req.user.role !== "sender")
    return res.status(403).json({ message: "Access denied" });

  senderDB.query(
    "SHOW TABLES",
    (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
      
      const tables = results.map(row => Object.values(row)[0]);
      res.json({ tables });
    }
  );
});

// Get sender statistics
app.get("/sender-stats", verifyToken, (req, res) => {
  if (req.user.role !== "sender")
    return res.status(403).json({ message: "Access denied" });

  receiverDB.query(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = '✅ Received' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status LIKE 'Rejected%' THEN 1 ELSE 0 END) as rejected
    FROM received_log`,
    (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
      res.json({ stats: results[0] });
    }
  );
});

/* ------------------- QUERY-BASED DATA SHARING ENDPOINTS ------------------- */

// Get sender database tables for receiver
app.get('/sender-tables', verifyToken, (req, res) => {
    if (req.user.role !== 'receiver') {
        return res.status(403).json({ message: 'Access denied' });
    }

    senderDB.query('SHOW TABLES', (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err.message });
        }
        res.json({ tables: results });
    });
});

// Receiver sends query request
app.post('/query-request', verifyToken, (req, res) => {
    if (req.user.role !== 'receiver') {
        return res.status(403).json({ message: 'Only receiver can request queries' });
    }

    const { query, limit_results, requested_by } = req.body;

    if (!query) {
        return res.json({ success: false, message: 'No query provided' });
    }

    // Validate query (only allow SELECT)
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('drop ') || lowerQuery.includes('delete ') || 
        lowerQuery.includes('truncate ') || lowerQuery.includes('alter ') ||
        lowerQuery.includes('insert ') || lowerQuery.includes('update ')) {
        return res.json({ success: false, message: 'Only SELECT queries are allowed' });
    }

    // Apply limit if requested
    let finalQuery = query;
    if (limit_results && !query.toLowerCase().includes('limit')) {
        finalQuery = query.replace(/;?$/, ' LIMIT 100;');
    }

    receiverDB.query(
        'INSERT INTO query_requests (query, requested_by, status) VALUES (?, ?, "pending")',
        [finalQuery, requested_by],
        (err, result) => {
            if (err) {
                return res.json({ success: false, message: 'Database error: ' + err.message });
            }
            res.json({ 
                success: true, 
                message: 'Query sent for approval',
                request_id: result.insertId
            });
        }
    );
});

// Get pending queries for receiver
app.get('/pending-queries', verifyToken, (req, res) => {
    if (req.user.role !== 'receiver') {
        return res.status(403).json({ message: 'Access denied' });
    }

    receiverDB.query(
        'SELECT * FROM query_requests WHERE status = "pending" ORDER BY created_at DESC',
        (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            res.json({ queries: results });
        }
    );
});

// Get pending queries for sender
app.get('/sender-pending-queries', verifyToken, (req, res) => {
    if (req.user.role !== 'sender') {
        return res.status(403).json({ message: 'Only sender can access query requests' });
    }

    receiverDB.query(
        'SELECT * FROM query_requests WHERE status = "pending" ORDER BY created_at DESC',
        (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            res.json({ queries: results });
        }
    );
});

// Preview query result for sender
app.post('/preview-query', verifyToken, (req, res) => {
    if (req.user.role !== 'sender') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const { request_id } = req.body;

    receiverDB.query(
        'SELECT query FROM query_requests WHERE request_id = ? AND status = "pending"',
        [request_id],
        (err, results) => {
            if (err || results.length === 0) {
                return res.json({ success: false, message: 'Query request not found' });
            }

            const query = results[0].query;

            // Execute query on sender database
            senderDB.query(query, (err, rows) => {
                if (err) {
                    return res.json({ success: false, message: 'Query error: ' + err.message });
                }

                // Get column headers
                const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

                res.json({
                    success: true,
                    result: {
                        rows: rows.slice(0, 100), // Limit preview to 100 rows
                        headers: headers,
                        total_rows: rows.length
                    }
                });
            });
        }
    );
});

// Approve and execute query - AUTO-SAVE VERSION (FIXED FOR EMPTY RESULTS)
app.post('/approve-query', verifyToken, (req, res) => {
    if (req.user.role !== 'sender') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const { request_id } = req.body;

    receiverDB.query(
        'SELECT query, requested_by FROM query_requests WHERE request_id = ? AND status = "pending"',
        [request_id],
        (err, results) => {
            if (err || results.length === 0) {
                return res.json({ success: false, message: 'Query request not found' });
            }

            const query = results[0].query;
            const requestedBy = results[0].requested_by;

            // Execute query on sender database
            senderDB.query(query, (err, rows) => {
                if (err) {
                    return res.json({ success: false, message: 'Query error: ' + err.message });
                }

                // Get column headers - even for empty results
                let headers = [];
                if (rows && rows.length > 0) {
                    headers = Object.keys(rows[0]);
                } else {
                    // For empty results, try to get column info from the database
                    const tableMatch = query.match(/FROM\s+(\w+)/i);
                    if (tableMatch && tableMatch[1]) {
                        const tableName = tableMatch[1];
                        senderDB.query(`DESCRIBE \`${tableName}\``, (descErr, columns) => {
                            if (!descErr && columns) {
                                headers = columns.map(col => col.Field);
                                completeApprovalProcess();
                            } else {
                                completeApprovalProcess();
                            }
                        });
                    } else {
                        completeApprovalProcess();
                    }
                }

                function completeApprovalProcess() {
                    // Generate table name automatically
                    const tableName = `query_result_${request_id}_${Date.now()}`;

                    // Auto-save results as table in receiver database (even if empty)
                    saveQueryResultsAsTable(tableName, headers, rows || [], (saveErr, savedRows) => {
                        if (saveErr) {
                            return res.json({ success: false, message: 'Error saving results: ' + saveErr.message });
                        }

                        // Update query request with success status and table name
                        receiverDB.query(
                            'UPDATE query_requests SET status = "approved", result_data = ?, result_headers = ?, table_name = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?',
                            [JSON.stringify(rows || []), JSON.stringify(headers || []), tableName, request_id],
                            (updateErr) => {
                                if (updateErr) {
                                    console.error('Update error:', updateErr);
                                    return res.json({ success: false, message: 'Error updating request: ' + updateErr.message });
                                }

                                res.json({
                                    success: true,
                                    message: `Query approved. ${savedRows} rows saved as table '${tableName}'.`,
                                    row_count: savedRows,
                                    table_name: tableName
                                });
                            }
                        );
                    });
                }

                // If we have rows, complete the process immediately
                if (rows && rows.length > 0) {
                    completeApprovalProcess();
                }
            });
        }
    );
});

// Helper function to save query results as table (FIXED FOR EMPTY RESULTS)
function saveQueryResultsAsTable(tableName, headers, rows, callback) {
    // Always create the table, even for empty results
    const columns = headers && headers.length > 0 
        ? headers.map(header => `\`${header}\` TEXT`).join(', ')
        : 'result_data TEXT'; // Fallback column if no headers

    const createTableQuery = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (id INT AUTO_INCREMENT PRIMARY KEY, ${columns}, imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;

    receiverDB.query(createTableQuery, (createErr) => {
        if (createErr) {
            return callback(createErr, 0);
        }

        // If no rows to insert, just return success
        if (!rows || rows.length === 0) {
            return callback(null, 0);
        }

        // Insert data if we have rows
        let insertedCount = 0;
        const insertPromises = rows.map(row => {
            const columns = headers.map(h => `\`${h}\``).join(', ');
            const values = headers.map(h => mysql.escape(row[h] || '')).join(', ');
            const insertQuery = `INSERT INTO \`${tableName}\` (${columns}) VALUES (${values})`;
            
            return new Promise((resolve, reject) => {
                receiverDB.query(insertQuery, (insertErr, result) => {
                    if (insertErr) {
                        reject(insertErr);
                    } else {
                        insertedCount++;
                        resolve(result);
                    }
                });
            });
        });

        Promise.all(insertPromises)
            .then(() => callback(null, insertedCount))
            .catch(error => callback(error, insertedCount));
    });
}

// Reject query request
app.post('/reject-query', verifyToken, (req, res) => {
    if (req.user.role !== 'sender') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const { request_id } = req.body;

    receiverDB.query(
        'UPDATE query_requests SET status = "rejected" WHERE request_id = ?',
        [request_id],
        (err) => {
            if (err) {
                return res.json({ success: false, message: 'Database error: ' + err.message });
            }

            res.json({ success: true, message: 'Query request rejected' });
        }
    );
});

// Get approved queries for receiver
app.get('/approved-queries', verifyToken, (req, res) => {
    if (req.user.role !== 'receiver') {
        return res.status(403).json({ message: 'Access denied' });
    }

    receiverDB.query(
        'SELECT * FROM query_requests WHERE status = "approved" ORDER BY updated_at DESC',
        (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            res.json({ queries: results });
        }
    );
});

// Download query result as CSV
app.get('/download-query-csv/:request_id', verifyToken, (req, res) => {
    if (req.user.role !== 'receiver') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const requestId = req.params.request_id;

    receiverDB.query(
        'SELECT result_data, result_headers FROM query_requests WHERE request_id = ? AND status = "approved"',
        [requestId],
        (err, results) => {
            if (err || results.length === 0) {
                return res.status(404).json({ message: 'Query result not found' });
            }

            const resultData = JSON.parse(results[0].result_data);
            const headers = JSON.parse(results[0].result_headers);

            // Generate CSV
            let csv = headers.join(',') + '\n';
            
            resultData.forEach(row => {
                const rowData = headers.map(header => {
                    const value = row[header] || '';
                    // Escape quotes and wrap in quotes if contains comma
                    return `"${String(value).replace(/"/g, '""')}"`;
                });
                csv += rowData.join(',') + '\n';
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=query_result_${requestId}.csv`);
            res.send(csv);
        }
    );
});

/* ------------------- QUERY EXECUTION ------------------- */

// Run query on receiver database
app.post("/run-query", (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ message: "No query provided" });

  // Basic security check - prevent destructive operations
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('drop table') || lowerQuery.includes('delete from') || 
      lowerQuery.includes('truncate') || lowerQuery.includes('alter table')) {
    return res.status(400).json({ message: "❌ Destructive operations are not allowed" });
  }

  receiverDB.query(query, (err, results) => {
    if (err) return res.status(400).json({ message: "❌ SQL Error: " + err.message });
    res.json({ message: "✅ Query executed successfully", rows: results });
  });
});

/* ------------------- INITIALIZATION ENDPOINT ------------------- */
app.get('/init-system', (req, res) => {
    initializeDatabase();
    res.json({ success: true, message: 'Database initialization completed' });
});

/* ------------------- HEALTH CHECK ------------------- */

app.get("/health", (req, res) => {
  res.json({ 
    status: "✅ Server is running",
    timestamp: new Date().toISOString(),
    databases: {
      sender: senderDB.state === 'connected' ? '✅ Connected' : '❌ Disconnected',
      receiver: receiverDB.state === 'connected' ? '✅ Connected' : '❌ Disconnected'
    }
  });
});

/* ------------------- START SERVER ------------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Secure DB Proxy Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`🔧 Init system: http://localhost:${PORT}/init-system`);
});