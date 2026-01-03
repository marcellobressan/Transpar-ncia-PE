// Script para inicializar o banco de dados
// Execute com: npx tsx services/initDb.ts

import { initializeDatabase, testConnection } from './database';

async function main() {
  console.log('🔄 Testing database connection...');
  
  const connected = await testConnection();
  
  if (!connected) {
    console.error('❌ Could not connect to database. Check your connection string.');
    process.exit(1);
  }

  console.log('🔄 Initializing database schema...');
  
  try {
    await initializeDatabase();
    console.log('✅ Database setup complete!');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

main();
