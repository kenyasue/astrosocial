/** Shared constants for the E2E setup and Playwright config. */
import path from 'node:path';

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_DB_PATH = path.join(process.cwd(), 'e2e', '.tmp', 'e2e.db');
export const E2E_UPLOADS_DIR = path.join(process.cwd(), 'e2e', '.tmp', 'uploads');

/** Folder where step-by-step screenshots are written for visual inspection. */
export const E2E_SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots');
