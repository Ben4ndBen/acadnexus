import "dotenv/config";
import db from "../src/lib/db";

async function main() {
  try {
    console.log("Adding columns to EXAMINATIONS table...");
    await db.$executeRawUnsafe(`
      ALTER TABLE "EXAMINATIONS" 
      ADD COLUMN IF NOT EXISTS "term" VARCHAR(50),
      ADD COLUMN IF NOT EXISTS "exam_date" DATE,
      ADD COLUMN IF NOT EXISTS "semester" VARCHAR(50),
      ADD COLUMN IF NOT EXISTS "document_reference" VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "selected_student_ids" INTEGER[] DEFAULT '{}';
    `);
    console.log("Successfully added columns to EXAMINATIONS!");

    const cols = await db.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'EXAMINATIONS'
      ORDER BY ordinal_position
    `);
    console.log("Updated EXAMINATIONS COLUMNS:", cols);
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    process.exit(0);
  }
}

main();
