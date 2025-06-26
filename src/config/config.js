import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  github: {
    token: process.env.GITHUB_TOKEN,
    username: process.env.GITHUB_USERNAME,
    apiDelay: parseInt(process.env.API_DELAY_MS) || 1000,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3
  },
  sync: {
    emails: process.env.SYNC_EMAILS ? process.env.SYNC_EMAILS.split(',').map(email => email.trim()) : [],
    defaultEmail: process.env.DEFAULT_SYNC_EMAIL || 'ccr@unex.es',
    autoConfirm: process.env.EMAIL_SYNC_AUTO_CONFIRM === 'true',
    createSeparateFolders: process.env.EMAIL_SYNC_CREATE_SEPARATE_FOLDERS === 'true',
    includePrivateRepos: process.env.EMAIL_SYNC_INCLUDE_PRIVATE_REPOS === 'true'
  },
  repo: {
    defaultName: process.env.DEFAULT_REPO_NAME || 'commit-history',
    defaultBranch: process.env.DEFAULT_BRANCH || 'main',
    maxCommitsPerDay: parseInt(process.env.MAX_COMMITS_PER_DAY) || 10,
    minCommitsPerDay: parseInt(process.env.MIN_COMMITS_PER_DAY) || 1
  },
  web: {
    port: process.env.WEB_PORT || 3000,
    host: process.env.WEB_HOST || 'localhost'
  }
};

// Validar configuración crítica
export function validateConfig() {
  const errors = [];
  
  if (!config.github.token) {
    errors.push('GITHUB_TOKEN is required');
  }
  
  if (!config.github.username) {
    errors.push('GITHUB_USERNAME is required');
  }
  
  if (config.sync.emails.length === 0) {
    errors.push('At least one email in SYNC_EMAILS is required');
  }
  
  return errors;
}
