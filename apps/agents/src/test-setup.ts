/**
 * Vitest setup file - loads environment variables before tests
 */
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env from the agents directory
dotenv.config({ path: resolve(__dirname, '../.env') });
