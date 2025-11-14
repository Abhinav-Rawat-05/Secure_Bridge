# SecureBridge – Secure Relay for Sender–Receiver SQL Workflows

SecureBridge is a secure, role-based database workflow system that allows a sender to submit SQL queries which are reviewed and approved by a receiver before execution. The relay server manages authentication, validation, SQL execution, and audit logging to ensure safe and controlled database interactions.

The system includes:

* Node.js (Express) relay server
* Sender and Receiver web clients
* MySQL databases
* JWT authentication, bcrypt hashing
* Complete audit trail functionality

---

## Key Features

1. Secure Authentication

   * JWT login
   * Bcrypt password hashing
   * Role separation (Sender/Receiver)

2. Sender Module

   * Compose SQL queries
   * Submit requests
   * Track request status
   * Download results (JSON/CSV)

3. Receiver Module

   * View and review pending requests
   * Approve or reject
   * Trigger execution
   * Track activity history

4. Relay Server

   * Validates SQL
   * Blocks unsafe operations
   * Executes only approved queries
   * Logs all events

5. Audit Logging

   * Records request lifecycle
   * Timestamps, user IDs, actions
   * Ensures transparency

6. Sample Hospital Database

   * Patients
   * Doctors
   * Appointments
   * Medical records

---

## Project Structure

```
SecureBridge/
│
├── server.js
├── package.json
├── create_hash.js
├── setup_database.sql
│
├── sender/
│   ├── sender.html
│   ├── sender.js
│   └── sender.css
│
└── receiver/
    ├── receiver.html
    ├── receiver.js
    └── receiver.css
```

---

## Installation & Setup

1. Install Node.js and MySQL.

2. Install dependencies:

```
npm install
```

3. Import database schema:

```
mysql -u root -p < setup_database.sql
```

4. Start server:

```
node server.js
```

Server runs at:

```
http://localhost:3000
```

---

## Usage

### Sender

1. Open sender/sender.html
2. Login
3. Enter SQL query
4. Submit
5. Wait for approval
6. Download results

### Receiver

1. Open receiver/receiver.html
2. Login
3. View pending requests
4. Approve or reject
5. Trigger execution
6. View logs and results

---

## Database Summary

### sender_db

* patients
* doctors
* appointments
* medical_records

### receiver_db

* users
* query_requests
* audit_log

---

## API Overview

POST /login – user authentication
POST /submit – submit SQL request
GET /pending – view pending requests (receiver)
POST /approve – approve or reject
POST /execute – execute approved SQL
GET /audit – view audit logs

---

## Security Measures

* Password hashing (bcrypt)
* JWT authorization on all routes
* SQL validation
* Restricted keywords blocked
* Full audit trail
* Role-specific actions

---

## Future Enhancements

* Admin dashboard
* Advanced analytics
* Natural language to SQL
* Docker deployment
* Multi-user team support

---

## Authors

* Abhinav Rawat (Team Lead)
* Yashu Bansal
* Aakash Kumar
* Sumit Joshi

Project for: DBMS Course, GEHU

---

## License

Open for educational and academic use.


