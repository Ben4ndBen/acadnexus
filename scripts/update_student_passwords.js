const { Client } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  console.log("Connecting directly to PostgreSQL database...");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log("Connected successfully.");

  // Fetch all students
  const res = await client.query(`
    SELECT user_id, institutional_id 
    FROM "USERS" 
    WHERE role = 'Student'
    ORDER BY institutional_id ASC
  `);

  const students = res.rows;
  console.log(`Found ${students.length} student users in database.`);

  if (students.length === 0) {
    console.log("No student accounts to update.");
    await client.end();
    return;
  }

  console.log("Precomputing bcrypt password hashes (concurrency: 20)...");
  const salt = await bcrypt.genSalt(10);
  const updates = [];

  // Group by distinct 4-digit password to minimize duplicate bcrypt hash operations!
  const passwordHashMap = new Map();
  for (const s of students) {
    const rawId = (s.institutional_id || "").trim();
    const parts = rawId.split("-");
    const middle4 = (parts.length >= 2 && parts[1]) ? parts[1].trim() : rawId;
    if (!passwordHashMap.has(middle4)) {
      passwordHashMap.set(middle4, null);
    }
  }

  console.log(`Found ${passwordHashMap.size} unique 4-digit passwords across ${students.length} students.`);
  
  // Hash unique passwords with concurrency
  const uniquePasswords = Array.from(passwordHashMap.keys());
  for (let i = 0; i < uniquePasswords.length; i += 20) {
    const chunk = uniquePasswords.slice(i, i + 20);
    await Promise.all(
      chunk.map(async (pwd) => {
        const hash = await bcrypt.hash(pwd, salt);
        passwordHashMap.set(pwd, hash);
      })
    );
  }
  console.log("All bcrypt hashes computed.");

  // Execute updates in batches of 50
  console.log("Applying password updates to database in batches...");
  const batchSize = 50;
  let updatedCount = 0;

  for (let i = 0; i < students.length; i += batchSize) {
    const chunk = students.slice(i, i + batchSize);
    
    // Construct single CASE WHEN query for the batch
    const caseClauses = [];
    const idList = [];
    
    for (const s of chunk) {
      const rawId = (s.institutional_id || "").trim();
      const parts = rawId.split("-");
      const middle4 = (parts.length >= 2 && parts[1]) ? parts[1].trim() : rawId;
      const hash = passwordHashMap.get(middle4);
      
      caseClauses.push(`WHEN user_id = ${s.user_id} THEN '${hash}'`);
      idList.push(s.user_id);
    }

    const query = `
      UPDATE "USERS"
      SET 
        password_hash = CASE ${caseClauses.join(" ")} END,
        require_password_update = false
      WHERE user_id IN (${idList.join(",")})
    `;

    await client.query(query);
    updatedCount += chunk.length;
    process.stdout.write(`Updated ${updatedCount}/${students.length} students...\r`);
  }

  console.log(`\nSuccessfully updated all ${updatedCount} student account passwords!`);

  // Verify by printing a sample of 5 students
  const verifyRes = await client.query(`
    SELECT user_id, institutional_id, password_hash
    FROM "USERS"
    WHERE role = 'Student'
    ORDER BY institutional_id ASC
    LIMIT 5
  `);

  console.log("\nVerification samples:");
  for (const s of verifyRes.rows) {
    const rawId = s.institutional_id.trim();
    const middle4 = rawId.split("-")[1];
    const isMatch = await bcrypt.compare(middle4, s.password_hash);
    console.log(`  - Student ${rawId}: middle 4 digits "${middle4}" -> password match verified: ${isMatch}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
