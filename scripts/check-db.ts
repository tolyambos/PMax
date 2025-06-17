import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Check for dev user
    const devUser = await prisma.user.findUnique({
      where: { id: 'dev-user-id' },
    });
    
    console.log('Dev User:', devUser ? 'Found' : 'Not Found');
    if (devUser) {
      console.log('User Details:', {
        id: devUser.id,
        name: devUser.name,
        email: devUser.email,
        createdAt: devUser.createdAt,
      });
    } else {
      console.log('Creating dev user...');
      const newUser = await prisma.user.create({
        data: {
          id: 'dev-user-id',
          name: 'Development User',
          email: 'dev@example.com',
        },
      });
      console.log('Created dev user:', newUser.id);
    }
    
    // Check for projects
    const projects = await prisma.project.findMany({
      where: { userId: 'dev-user-id' },
      include: {
        _count: {
          select: { scenes: true },
        },
      },
    });
    
    console.log(`Found ${projects.length} projects:`);
    projects.forEach((project, index) => {
      console.log(`Project ${index + 1}:`);
      console.log(`  ID: ${project.id}`);
      console.log(`  Name: ${project.name}`);
      console.log(`  Created: ${project.createdAt}`);
      console.log(`  Scenes: ${project._count.scenes}`);
      console.log('');
    });
  } catch (error) {
    console.error('Database check error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();