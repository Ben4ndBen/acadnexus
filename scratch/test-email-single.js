const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(url, key);

async function testSingle(email) {
  console.log(`Testing: ${email}`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: "password123!",
  });
  if (error) {
    console.log("ERROR:", error.status, error.code, error.message);
  } else {
    console.log("SUCCESS:", data.user?.id);
  }
}

// Test with 1 email
testSingle(process.argv[2] || "faculty-001@acadnexus.bsc.edu.ph");
