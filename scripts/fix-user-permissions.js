const { PrismaClient } = require('@prisma/client');

async function fixUserPermissions() {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 Fixing user permissions...');

    // Update all existing users to have canCreateProjects: true
    const result = await prisma.permission.updateMany({
      where: {
        canCreateProjects: false,
      },
      data: {
        canCreateProjects: true,
      },
    });

    console.log(`✅ Updated ${result.count} users to allow project creation`);

    // Find users without permissions and create them
    const usersWithoutPermissions = await prisma.user.findMany({
      where: {
        permissions: {
          none: {},
        },
      },
    });

    for (const user of usersWithoutPermissions) {
      await prisma.permission.create({
        data: {
          userId: user.id,
          canCreateProjects: true,
          canUploadAssets: true,
          maxProjects: user.role === 'ADMIN' ? 1000 : 10,
          maxAssetStorage: user.role === 'ADMIN' ? 107374182400 : 1073741824,
        },
      });
      console.log(`✅ Created permissions for user: ${user.email}`);
    }

    console.log('🎉 User permissions fixed successfully!');
  } catch (error) {
    console.error('❌ Error fixing user permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserPermissions();