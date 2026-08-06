import "dotenv/config";
import db from "../src/lib/db";

async function main() {
  try {
    const courses = await db.studentCourse.findMany();
    console.log("SUCCESS! Student courses count:", courses.length);
  } catch (err) {
    console.error("Full error:", err);
  } finally {
    process.exit(0);
  }
}

main();
