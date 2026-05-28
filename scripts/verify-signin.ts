import { config } from "dotenv";
config({ path: ".env.local" });

import { authConfig } from "../src/auth.config";

type Case = {
  name: string;
  profile: Record<string, unknown> | null;
  expected: boolean;
};

const cases: Case[] = [
  {
    name: "valid: penta + email_verified",
    profile: {
      email_verified: true,
      hd: "pentasecurity.com",
      email: "u@pentasecurity.com",
    },
    expected: true,
  },
  {
    name: "reject: gmail account (no hd)",
    profile: { email_verified: true, email: "u@gmail.com" },
    expected: false,
  },
  {
    name: "reject: other workspace domain",
    profile: {
      email_verified: true,
      hd: "attacker.com",
      email: "u@attacker.com",
    },
    expected: false,
  },
  {
    name: "reject: email_verified=false (even from penta)",
    profile: {
      email_verified: false,
      hd: "pentasecurity.com",
      email: "u@pentasecurity.com",
    },
    expected: false,
  },
  {
    name: "reject: null profile",
    profile: null,
    expected: false,
  },
];

async function main() {
  const signIn = authConfig.callbacks?.signIn;
  if (typeof signIn !== "function") {
    console.error("signIn callback not defined in authConfig");
    process.exit(1);
  }

  let pass = 0;
  let fail = 0;
  for (const c of cases) {
    const arg = {
      profile: c.profile,
      user: {},
      account: { provider: "google" },
    } as Parameters<typeof signIn>[0];
    const result = await signIn(arg);
    const ok = result === c.expected;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${c.name} → ${result} (expected ${c.expected})`,
    );
    ok ? pass++ : fail++;
  }
  console.log("---");
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
