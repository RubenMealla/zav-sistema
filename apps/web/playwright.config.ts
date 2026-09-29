import { defineConfig, devices } from '@playwright/test';

const esCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: esCI,
  retries: esCI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: 'test-results',
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-escritorio',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --dir ../api start:prod',
      env: { NODE_ENV: 'test', PORT: '3001' },
      url: 'http://127.0.0.1:3001',
      reuseExistingServer: !esCI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm start',
      env: { NODE_ENV: 'production', PORT: '3000' },
      url: 'http://127.0.0.1:3000/acceso',
      reuseExistingServer: !esCI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
