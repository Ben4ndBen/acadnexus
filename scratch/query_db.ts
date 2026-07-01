import db from "../src/lib/db";

async function main() {
  console.log("=== PORTFOLIOS ===");
  const portfolios = await db.facultyPortfolio.findMany();
  console.log(portfolios);

  console.log("=== SYSTEM SETTINGS ===");
  const settings = await db.systemSetting.findMany();
  console.log(settings);

  console.log("=== AUDIT LOGS (LATEST 5) ===");
  const auditLogs = await db.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 5
  });
  console.log(auditLogs);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
