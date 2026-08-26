import { config } from "../src/config/index.js";

async function testJiraConnection() {
  const baseUrl = config.JIRA_URL.replace(/\/$/, "");
  const auth = Buffer.from(`${config.JIRA_USERNAME}:${config.JIRA_API_TOKEN}`).toString("base64");

  console.log("JIRA URL:", baseUrl);
  console.log("Username:", config.JIRA_USERNAME);
  console.log("Token length:", config.JIRA_API_TOKEN?.length || 0);

  // Test 1: Check my permissions
  console.log("\n--- Test 1: Myself endpoint ---");
  try {
    const res = await fetch(`${baseUrl}/rest/api/2/myself`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    console.log("Status:", res.status, res.statusText);
    if (res.ok) {
      const data = await res.json();
      console.log("Account ID:", data.accountId);
      console.log("Display Name:", data.displayName);
    } else {
      console.log("Body:", await res.text());
    }
  } catch (e) {
    console.error("Error:", e);
  }

  // Test 2: List accessible projects
  console.log("\n--- Test 2: Projects endpoint ---");
  try {
    const res = await fetch(`${baseUrl}/rest/api/2/project`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    console.log("Status:", res.status, res.statusText);
    if (res.ok) {
      const projects = await res.json();
      console.log("Accessible projects:", projects.map((p: any) => `${p.key}: ${p.name}`));
    } else {
      console.log("Body:", await res.text());
    }
  } catch (e) {
    console.error("Error:", e);
  }

  // Test 3: Try to fetch KAN-2
  console.log("\n--- Test 3: Fetch KAN-2 ---");
  try {
    const res = await fetch(`${baseUrl}/rest/api/2/issue/KAN-2`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    console.log("Status:", res.status, res.statusText);
    if (res.ok) {
      const data = await res.json();
      console.log("Ticket:", data.key, "-", data.fields?.summary);
    } else {
      console.log("Body:", await res.text());
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

testJiraConnection();
