// create_hash.js
import bcrypt from "bcryptjs";

const password = process.argv[2] || "password123"; // default password

console.log("🔐 Password Hash Generator");
console.log("========================\n");

bcrypt.hash(password, 10)
    .then(hash => {
        console.log("📝 IMPORTANT: Copy this hash and update setup_database.sql");
        console.log("=========================================================\n");
        
        console.log("Plain Password: ", password);
        console.log("Generated Hash: ", hash);
        
        console.log("\n📋 Steps to update:");
        console.log("1. Open setup_database.sql");
        console.log("2. Find the line with: INSERT INTO auth_users (username, password_hash, role) VALUES");
        console.log("3. Replace '$2a$10$8K1p/a0dRL1SzdiKJe7.ue1g' with the hash above");
        console.log("4. Save the file and run the SQL in MySQL");
        
        console.log("\n✅ Example of updated SQL:");
        console.log(`INSERT INTO auth_users (username, password_hash, role) VALUES`);
        console.log(`('receiver_user', '${hash}', 'receiver'),`);
        console.log(`('sender_user', '${hash}', 'sender');`);
    })
    .catch(err => {
        console.error("❌ Error generating hash:", err);
    });