import "dotenv/config";
import db from "../src/lib/db";

async function main() {
  try {
    const cols = await db.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'EXAMINATIONS'
      ORDER BY ordinal_position
    `);
    console.log("EXAMINATIONS COLUMNS:", cols);
  } catch (err) {
    console.error("Full error:", err);
  } finally {
    process.exit(0);
  }
}

main();
