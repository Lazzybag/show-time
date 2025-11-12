import 'dotenv/config';
import cron from 'node-cron';
import { Octokit } from '@octokit/rest';
import fs from 'fs';

console.log('🕒 Starting continuous monitor...');

// Run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log(`\n🔍 Scheduled scan started at: ${new Date().toISOString()}`);
  
  // Import and run scanner
  const { ForkHunter } = await import('./scanner.js');
  const hunter = new ForkHunter();
  await hunter.searchVulnerableForks();
});

console.log('✅ Monitor active. Scanning every 6 hours...');
