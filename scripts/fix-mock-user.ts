/**
 * Script to ensure the mock user exists
 * Run with: npx ts-node scripts/fix-mock-user.ts
 */

import { prisma, ensureMockUser } from '../src/app/utils/db';

async function main() {
  console.log('Starting mock user fix script...');
  
  try {
    console.log('Checking if mock user exists...');
    const success = await ensureMockUser();
    
    if (success) {
      console.log('Mock user is now available in the database.');
    } else {
      console.error('Failed to ensure mock user exists.');
    }
    
    // Count projects for this user
    const projects = await prisma.project.findMany({
      where: { userId: 'user-123' },
    });
    
    console.log(`Found ${projects.length} projects for the mock user.`);
    
    console.log('Script completed successfully.');
  } catch (error) {
    console.error('Error running fix script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();