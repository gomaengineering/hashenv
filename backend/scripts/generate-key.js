/**
 * Helper script to generate a secure encryption key
 * Run with: node scripts/generate-key.js
 */

const crypto = require('crypto');

const key = crypto.randomBytes(32).toString('base64');
console.log('\nGenerated 32-byte encryption key (base64-encoded):\n');
console.log(key);
console.log('\nAdd this to your .env file as:');
console.log(`MASTER_ENCRYPTION_KEY=${key}\n`);
console.log('⚠️  Keep this key secure! Store it in a safe place.\n');
