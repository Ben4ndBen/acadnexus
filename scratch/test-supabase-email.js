const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log("URL:", url);
console.log("Key:", key ? key.substring(0, 15) + "..." : "missing");

const supabase = createClient(url, key);

async function testEmails() {
  const emailsToTest = [
    "faculty-001@acadnexus.bsc.edu.ph",
    "faculty001@acadnexus.bsc.edu.ph",
    "faculty-001@bsc.edu.ph",
    "faculty-001@acadnexus.com",
    "faculty.001@acadnexus.bsc.edu.ph",
    "faculty_001@acadnexus.bsc.edu.ph"
  ];

  for (const email of emailsToTest) {
    console.log(`\nTesting email: "${email}"`);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: "password123!",
    });
    if (error) {
      console.log(`Result: ERROR -> ${error.message} (status: ${error.status})`);
    } else {
      console.log(`Result: SUCCESS -> User ID: ${data.user?.id}`);
    }
  }
}

testEmails();
