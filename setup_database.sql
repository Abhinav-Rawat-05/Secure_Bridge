-- Create databases
CREATE DATABASE IF NOT EXISTS sender_db;
CREATE DATABASE IF NOT EXISTS receiver_db;

USE sender_db;

-- Create sample tables for sender
CREATE TABLE IF NOT EXISTS patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT,
    condition VARCHAR(200),
    admission_date DATE,
    department VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100),
    salary DECIMAL(10,2),
    join_date DATE
);

CREATE TABLE IF NOT EXISTS appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    doctor_name VARCHAR(100),
    appointment_date DATETIME,
    status VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS medical_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    diagnosis TEXT,
    treatment TEXT,
    prescription TEXT,
    visit_date DATE
);

CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    head_doctor VARCHAR(100),
    floor INT
);

-- Insert sample data
INSERT INTO patients (name, age, condition, admission_date, department) VALUES
('John Smith', 45, 'Hypertension', '2024-01-15', 'Cardiology'),
('Maria Garcia', 32, 'Diabetes', '2024-01-20', 'Endocrinology'),
('David Johnson', 67, 'Arthritis', '2024-01-18', 'Orthopedics'),
('Sarah Wilson', 28, 'Pregnancy', '2024-01-22', 'Obstetrics'),
('Robert Brown', 55, 'Heart Disease', '2024-01-25', 'Cardiology'),
('Lisa Davis', 42, 'Migraine', '2024-01-19', 'Neurology'),
('Michael Miller', 38, 'Fracture', '2024-01-21', 'Orthopedics'),
('Jennifer Taylor', 29, 'Asthma', '2024-01-23', 'Pulmonology'),
('William Anderson', 61, 'Diabetes', '2024-01-24', 'Endocrinology'),
('Emily Thomas', 35, 'Anxiety', '2024-01-26', 'Psychiatry');

INSERT INTO employees (name, department, position, salary, join_date) VALUES
('Dr. Robert Brown', 'Cardiology', 'Senior Consultant', 120000, '2020-03-15'),
('Dr. Emily Chen', 'Endocrinology', 'Consultant', 95000, '2021-06-20'),
('Dr. Michael Davis', 'Orthopedics', 'Head of Department', 150000, '2018-11-10'),
('Nurse Jennifer Lee', 'Obstetrics', 'Head Nurse', 65000, '2019-08-05'),
('Dr. Sarah Johnson', 'Neurology', 'Consultant', 110000, '2020-09-12'),
('Dr. James Wilson', 'Pulmonology', 'Senior Consultant', 125000, '2019-04-18'),
('Nurse Mark Thompson', 'Cardiology', 'Staff Nurse', 55000, '2021-01-15'),
('Dr. Amanda White', 'Psychiatry', 'Consultant', 105000, '2020-07-22'),
('Dr. Christopher Lee', 'Surgery', 'Surgeon', 140000, '2018-12-03'),
('Nurse Samantha Green', 'Emergency', 'Emergency Nurse', 60000, '2021-03-10');

INSERT INTO appointments (patient_id, doctor_name, appointment_date, status) VALUES
(1, 'Dr. Robert Brown', '2024-02-01 10:00:00', 'Scheduled'),
(2, 'Dr. Emily Chen', '2024-02-01 14:30:00', 'Scheduled'),
(3, 'Dr. Michael Davis', '2024-02-02 09:15:00', 'Completed'),
(4, 'Nurse Jennifer Lee', '2024-02-02 11:00:00', 'Scheduled'),
(5, 'Dr. Robert Brown', '2024-02-03 10:30:00', 'Scheduled'),
(6, 'Dr. Sarah Johnson', '2024-02-03 15:45:00', 'Cancelled'),
(7, 'Dr. Michael Davis', '2024-02-04 08:30:00', 'Scheduled'),
(8, 'Dr. James Wilson', '2024-02-04 13:15:00', 'Scheduled'),
(9, 'Dr. Emily Chen', '2024-02-05 11:30:00', 'Scheduled'),
(10, 'Dr. Amanda White', '2024-02-05 16:00:00', 'Scheduled');

INSERT INTO medical_records (patient_id, diagnosis, treatment, prescription, visit_date) VALUES
(1, 'Hypertension Stage 2', 'Lifestyle modification and medication', 'Lisinopril 10mg daily', '2024-01-15'),
(2, 'Type 2 Diabetes', 'Diet control and oral medication', 'Metformin 500mg twice daily', '2024-01-20'),
(3, 'Osteoarthritis', 'Physical therapy and pain management', 'Ibuprofen 400mg as needed', '2024-01-18'),
(4, 'Normal Pregnancy', 'Routine prenatal care', 'Prenatal vitamins daily', '2024-01-22'),
(5, 'Coronary Artery Disease', 'Cardiac rehabilitation', 'Aspirin 81mg daily', '2024-01-25'),
(6, 'Chronic Migraine', 'Preventive therapy', 'Topiramate 25mg daily', '2024-01-19'),
(7, 'Fractured Radius', 'Cast immobilization', 'Acetaminophen for pain', '2024-01-21'),
(8, 'Bronchial Asthma', 'Inhaler therapy', 'Albuterol inhaler as needed', '2024-01-23'),
(9, 'Type 2 Diabetes', 'Insulin therapy', 'Lantus 20 units nightly', '2024-01-24'),
(10, 'Generalized Anxiety', 'Cognitive behavioral therapy', 'Sertraline 50mg daily', '2024-01-26');

INSERT INTO departments (name, head_doctor, floor) VALUES
('Cardiology', 'Dr. Robert Brown', 2),
('Endocrinology', 'Dr. Emily Chen', 3),
('Orthopedics', 'Dr. Michael Davis', 1),
('Obstetrics', 'Dr. Sarah Johnson', 4),
('Neurology', 'Dr. James Wilson', 2),
('Pulmonology', 'Dr. Amanda White', 3),
('Psychiatry', 'Dr. Christopher Lee', 5),
('Surgery', 'Dr. Jennifer Taylor', 1),
('Emergency', 'Dr. Mark Wilson', 1),
('Pediatrics', 'Dr. Lisa Anderson', 4);

USE receiver_db;

-- Create authentication table
CREATE TABLE IF NOT EXISTS auth_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('sender', 'receiver') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create received log table
CREATE TABLE IF NOT EXISTS received_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id VARCHAR(100),
    table_name VARCHAR(100),
    status VARCHAR(100) DEFAULT 'Pending',
    payload_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create query_requests table
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
);

-- Insert default users (passwords are 'password123')
-- Generate these hashes first using: node create_hash.js
-- Then update the hash below with the generated one
INSERT INTO auth_users (username, password_hash, role) VALUES
('rec', '$2a$10$9LFfg535kja.00j5xteiheyN/NJDsEIef0f2QXfmO4L8/Q943D0hS', 'receiver'),
('sen', '$2a$10$9LFfg535kja.00j5xteiheyN/NJDsEIef0f2QXfmO4L8/Q943D0hS', 'sender');

-- Insert some sample request logs
INSERT INTO received_log (sender_id, table_name, status, payload_hash) VALUES
('HOSPITAL_A', 'patients', '✅ Received', 'abc123hash'),
('HOSPITAL_B', 'employees', 'Rejected: Invalid Sender', NULL),
('HOSPITAL_A', 'appointments', 'Pending', NULL);

-- Show final database status
SELECT '✅ Database setup completed successfully!' as status;
SELECT COUNT(*) as patient_count FROM sender_db.patients;
SELECT COUNT(*) as employee_count FROM sender_db.employees;
SELECT COUNT(*) as appointment_count FROM sender_db.appointments;
SELECT COUNT(*) as user_count FROM receiver_db.auth_users;
SELECT COUNT(*) as request_count FROM receiver_db.received_log;