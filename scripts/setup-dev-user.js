// Setup development user script
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupDevUser() {
  console.log('Setting up development user...');
  
  try {
    // Check if dev user exists
    const devUserId = 'dev-user-id';
    const existingUser = await prisma.user.findUnique({
      where: { id: devUserId }
    });
    
    if (existingUser) {
      console.log('Dev user already exists:', existingUser);
    } else {
      // Create dev user
      const newUser = await prisma.user.create({
        data: {
          id: devUserId,
          name: 'Development User',
          email: 'dev@example.com'
        }
      });
      
      console.log('Created dev user:', newUser);
    }
    
    // Create a test project
    const project = await prisma.project.create({
      data: {
        name: 'Sample Project',
        description: 'A sample project created for testing',
        userId: devUserId,
        format: '9:16'
      }
    });
    
    console.log('Created sample project:', project);
    
    console.log('Setup complete!');
  } catch (error) {
    console.error('Error setting up dev environment:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupDevUser();