import { defineConfig, devices } from "@playwright/test";

// Smoke test E2E contra el dev server ya corriendo en :3000.
// Credenciales por env: SMOKE_EMAIL / SMOKE_PASSWORD.
export default defineConfig({
  testDir: "./e2e",
  timeout: 360_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    ...devices["Desktop Chrome"],
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
