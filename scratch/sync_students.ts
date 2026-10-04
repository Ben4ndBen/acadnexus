import "dotenv/config";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { ALL_CURRICULUMS, getCurriculumForProgram } from "../src/lib/bsitCurriculum";

async function syncAll() {
  console.log("=== EXECUTING STUDENT SYNC, MIDDLE NAME & SUBJECT AUTO-ASSIGNMENT ===");

  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure middle_name column exists on STUDENTS table
    await client.query('ALTER TABLE "STUDENTS" ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);');

    // 2. Batch upsert curriculum courses into COURSES table
    console.log(`Upserting ${ALL_CURRICULUMS.length} curriculum courses...`);
    for (const item of ALL_CURRICULUMS) {
      await client.query(
        `INSERT INTO "COURSES" (course_code, course_title)
         VALUES ($1, $2)
         ON CONFLICT (course_code) DO UPDATE SET course_title = EXCLUDED.course_title;`,
        [item.code.trim(), item.title.trim()]
      );
    }
    console.log("Curriculum courses successfully synced.");

    // Create lookup map of course_code -> course_id
    const coursesRes = await client.query('SELECT course_id, UPPER(TRIM(course_code)) as code FROM "COURSES"');
    const courseMap = new Map<string, number>();
    coursesRes.rows.forEach(r => courseMap.set(r.code, r.course_id));

    // 3. Get or Create Academic Program "BS Info Tech"
    let progRes = await client.query(`
      SELECT program_id FROM "ACADEMIC_PROGRAMS"
      WHERE program_code = 'BS Info Tech' OR UPPER(program_name) LIKE '%INFORMATION TECHNOLOGY%'
      LIMIT 1;
    `);

    let programId: number;
    if (progRes.rowCount && progRes.rowCount > 0) {
      programId = progRes.rows[0].program_id;
    } else {
      let deptRes = await client.query(`SELECT department_id FROM "DEPARTMENTS" WHERE UPPER(department_name) LIKE '%IT%' LIMIT 1`);
      let deptId = (deptRes.rowCount && deptRes.rowCount > 0) ? deptRes.rows[0].department_id : 1;
      const newProg = await client.query(`
        INSERT INTO "ACADEMIC_PROGRAMS" (program_code, program_name, department_id)
        VALUES ('BS Info Tech', 'Bachelor of Science in Information Technology', $1)
        RETURNING program_id;
      `, [deptId]);
      programId = newProg.rows[0].program_id;
    }
    console.log(`Using Academic Program ID: ${programId}`);

    // 4. Load student data from students_data.json
    const rawData = fs.readFileSync(path.join(__dirname, 'students_data.json'), 'utf8');
    const studentsData = JSON.parse(rawData);
    console.log(`Loaded ${studentsData.length} students from JSON.`);

    const validIds = new Set(studentsData.map((s: any) => s.id.trim().toUpperCase()));

    let createdCount = 0;
    let updatedCount = 0;
    let totalSubjectEnrollments = 0;

    for (const s of studentsData) {
      const instId = s.id.trim().toUpperCase();
      const firstName = s.firstName.trim();
      const rawMiddle = (s.middleName || '').trim();
      const middleName = (!rawMiddle || rawMiddle.toUpperCase() === 'NONE') ? null : rawMiddle;
      const lastName = s.lastName.trim();
      const yearLevel = Number(s.yearLevel) || 1;
      const section = 'A';

      // Hash password specific to institutional_id for initial login
      const userPasswordHash = bcrypt.hashSync(instId, 10);

      // Check existing user
      const existingUserRes = await client.query(`SELECT user_id FROM "USERS" WHERE UPPER(institutional_id) = $1`, [instId]);
      let userId: number;

      if (existingUserRes.rowCount && existingUserRes.rowCount > 0) {
        userId = existingUserRes.rows[0].user_id;
        await client.query(`
          UPDATE "USERS"
          SET password_hash = $1, require_password_update = true, is_active = true
          WHERE user_id = $2;
        `, [userPasswordHash, userId]);

        const studentRes = await client.query(`SELECT student_id FROM "STUDENTS" WHERE student_id = $1`, [userId]);
        if (studentRes.rowCount && studentRes.rowCount > 0) {
          await client.query(`
            UPDATE "STUDENTS"
            SET first_name = $1, middle_name = $2, last_name = $3, program_id = $4, year_level = $5, section = $6
            WHERE student_id = $7;
          `, [firstName, middleName, lastName, programId, yearLevel, section, userId]);
        } else {
          await client.query(`
            INSERT INTO "STUDENTS" (student_id, first_name, middle_name, last_name, program_id, year_level, section)
            VALUES ($1, $2, $3, $4, $5, $6, $7);
          `, [userId, firstName, middleName, lastName, programId, yearLevel, section]);
        }
        updatedCount++;
      } else {
        const newUserRes = await client.query(`
          INSERT INTO "USERS" (institutional_id, password_hash, role, require_password_update, is_active)
          VALUES ($1, $2, 'Student', true, true)
          RETURNING user_id;
        `, [instId, userPasswordHash]);
        userId = newUserRes.rows[0].user_id;

        await client.query(`
          INSERT INTO "STUDENTS" (student_id, first_name, middle_name, last_name, program_id, year_level, section)
          VALUES ($1, $2, $3, $4, $5, $6, $7);
        `, [userId, firstName, middleName, lastName, programId, yearLevel, section]);
        createdCount++;
      }

      // AUTOMATICALLY ASSIGN SUBJECTS ACCORDING TO PROGRAM & YEAR LEVEL
      const curriculumItems = getCurriculumForProgram("BSIT", yearLevel);
      const courseIds: number[] = [];
      for (const cItem of curriculumItems) {
        const cId = courseMap.get(cItem.code.trim().toUpperCase());
        if (cId) {
          courseIds.push(cId);
        }
      }

      // Re-enroll student in their exact subjects
      await client.query(`DELETE FROM "STUDENT_COURSES" WHERE student_id = $1`, [userId]);

      for (const cId of courseIds) {
        await client.query(`
          INSERT INTO "STUDENT_COURSES" (student_id, course_id, enrolled_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (student_id, course_id) DO NOTHING;
        `, [userId, cId]);
        totalSubjectEnrollments++;
      }
    }

    console.log(`\nStudent Sync Summary:`);
    console.log(`  - Students Created: ${createdCount}`);
    console.log(`  - Students Updated: ${updatedCount}`);
    console.log(`  - Total Active Students: ${createdCount + updatedCount}`);
    console.log(`  - Total Subject Enrollment Records Created: ${totalSubjectEnrollments}`);

    // 5. REMOVE ALL OLD MOCK DATA
    console.log("\n--- CLEANING UP OLD MOCK DATA ---");

    // A. Delete old students not in current JSON list (e.g. Janice Delfin 2023-0001-AB, ben ben 2023-0005-AB, Yaniley Daroca 2023-1023-AB)
    const allStudentsRes = await client.query(`
      SELECT u.user_id, u.institutional_id, s.first_name, s.last_name
      FROM "USERS" u
      JOIN "STUDENTS" s ON u.user_id = s.student_id
      WHERE u.role = 'Student';
    `);

    const oldStudents = allStudentsRes.rows.filter(r => !validIds.has(r.institutional_id.trim().toUpperCase()));
    console.log(`Found ${oldStudents.length} old mock student accounts to remove:`, oldStudents.map(r => `${r.institutional_id} (${r.first_name} ${r.last_name})`));

    for (const oldUser of oldStudents) {
      const uId = oldUser.user_id;
      await client.query(`DELETE FROM "STUDENT_ANSWERS" WHERE student_exam_id IN (SELECT student_exam_id FROM "STUDENT_EXAMS" WHERE student_id = $1)`, [uId]);
      await client.query(`DELETE FROM "STUDENT_EXAMS" WHERE student_id = $1`, [uId]);
      await client.query(`DELETE FROM "STUDENT_OVERRIDES" WHERE student_id = $1`, [uId]);
      await client.query(`DELETE FROM "STUDENT_COURSES" WHERE student_id = $1`, [uId]);
      await client.query(`DELETE FROM "NOTIFICATIONS" WHERE user_id = $1`, [uId]);
      await client.query(`DELETE FROM "AUDIT_LOGS" WHERE user_id = $1`, [uId]);
      await client.query(`DELETE FROM "STUDENTS" WHERE student_id = $1`, [uId]);
      await client.query(`DELETE FROM "USERS" WHERE user_id = $1`, [uId]);
    }

    // B. Delete old mock programs (e.g. BSCS)
    const bscsRes = await client.query(`SELECT program_id, program_code FROM "ACADEMIC_PROGRAMS" WHERE UPPER(program_code) = 'BSCS' OR UPPER(program_name) LIKE '%COMPUTER SCIENCE%'`);
    if (bscsRes.rowCount && bscsRes.rowCount > 0) {
      for (const p of bscsRes.rows) {
        console.log(`Deleting old program: ${p.program_code}`);
        await client.query(`DELETE FROM "EXAM_TARGETS" WHERE program_id = $1`, [p.program_id]);
        await client.query(`DELETE FROM "STUDENTS" WHERE program_id = $1`, [p.program_id]);
        await client.query(`DELETE FROM "ACADEMIC_PROGRAMS" WHERE program_id = $1`, [p.program_id]);
      }
    }

    // C. Delete old non-curriculum mock courses (e.g. Intro to AI or legacy codes like AGRI101, IND101, EDUC101, THC1)
    const oldCoursesRes = await client.query(`
      SELECT course_id, course_code, course_title FROM "COURSES"
      WHERE UPPER(course_title) LIKE '%INTRO TO AI%'
         OR UPPER(course_title) LIKE '%ARTIFICIAL INTELLIGENCE%'
         OR UPPER(course_code) IN ('CS101', 'AGRI101', 'IND101', 'EDUC101', 'THC1');
    `);

    if (oldCoursesRes.rowCount && oldCoursesRes.rowCount > 0) {
      for (const c of oldCoursesRes.rows) {
        console.log(`Deleting old mock course: ${c.course_code} - ${c.course_title}`);
        await client.query(`DELETE FROM "STUDENT_COURSES" WHERE course_id = $1`, [c.course_id]);
        await client.query(`DELETE FROM "FACULTY_COURSES" WHERE course_id = $1`, [c.course_id]);
        await client.query(`DELETE FROM "QUESTION_BANK" WHERE course_id = $1`, [c.course_id]);
        await client.query(`DELETE FROM "EXAMINATIONS" WHERE course_id = $1`, [c.course_id]);
        await client.query(`DELETE FROM "COURSES" WHERE course_id = $1`, [c.course_id]);
      }
    }

    await client.query('COMMIT');
    console.log("\n=== ALL DATABASE OPERATIONS COMPLETED SUCCESSFULLY! ===");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error during sync:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

syncAll().catch(console.error);
