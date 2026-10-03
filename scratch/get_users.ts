import "dotenv/config";
import db from "../src/lib/db";

async function main() {
  const users = await db.user.findMany({
    include: {
      student: { include: { program: true } },
      faculty: { include: { department: true } },
      chair: { include: { department: true } },
      director: true,
    },
  });

  console.log("=== ALL USERS IN DATABASE ===");
  users.forEach((u) => {
    let details = "";
    if (u.role === "Student" && u.student) {
      details = `Name: ${u.student.first_name} ${u.student.last_name} | Program: ${u.student.program?.program_code} | Year: ${u.student.year_level} | Section: ${u.student.section}`;
    } else if (u.role === "Faculty" && u.faculty) {
      details = `Name: ${u.faculty.first_name} ${u.faculty.last_name} | Dept: ${u.faculty.department?.department_name}`;
    } else if (u.role === "Chair" && u.chair) {
      details = `Dept: ${u.chair.department?.department_name}`;
    } else if (u.role === "Director") {
      details = `Director Office`;
    }

    console.log(
      `Role: ${u.role.padEnd(8)} | Inst ID / Login ID: ${(u.institutional_id || "N/A").padEnd(16)} | Username: ${(u.username || "N/A").padEnd(16)} | ${details}`
    );
  });
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
