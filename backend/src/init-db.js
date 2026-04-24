import { dbPath, initializeDatabase } from './lib/db.js';

initializeDatabase();
console.log(`Local SQLite database is ready at ${dbPath}`);
