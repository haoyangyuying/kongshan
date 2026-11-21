import { defineConfig } from '@playwright/test';

const url = 'http://127.0.0.1:5200';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: url,
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL,
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--mute-audio'] },
  },
  webServer: {
    command: 'npm run serve',
    url,
    env: { HOST: '127.0.0.1', PORT: '5200' },
    reuseExistingServer: false,
  },
});
