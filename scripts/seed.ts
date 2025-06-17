import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.element.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.project.deleteMany();
  await prisma.asset.deleteMany();
  
  // We don't delete users since they are managed by Clerk
  
  console.log("Database cleared. Ready to seed...");

  // In a real app, you would seed with real data
  // For development purposes, just log that the database is ready
  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });