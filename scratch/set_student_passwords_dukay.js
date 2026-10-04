const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Generating bcrypt hash for password 'dukay'...");
  const salt = await bcrypt.genSalt(10);
  const dukayHash = await bcrypt.hash("dukay", salt);

  console.log("Updating all Student user passwords to 'dukay'...");
  const result = await prisma.user.updateMany({
    where: {
      role: "Student",
    },
    data: {
      password_hash: dukayHash,
      require_password_update: true,
    },
  });

  console.log(`Successfully updated ${result.count} student account passwords to 'dukay'!`);
}

main()
  .catch((e) => {
    console.error("Error updating student passwords:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
