import { PrismaClient } from '@prisma/client';
import superjson from 'superjson';

// Initialize Prisma
const prisma = new PrismaClient();

// Function to test serialization of project data
async function testSerialization() {
  try {
    // Get a project with all related data
    const project = await prisma.project.findFirst({
      include: {
        scenes: {
          include: {
            elements: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!project) {
      console.log('No projects found to test');
      return;
    }

    console.log(`Testing serialization for project: ${project.id} (${project.name})`);
    
    // 1. Test direct JSON stringification
    try {
      const directJson = JSON.stringify(project);
      console.log('Direct JSON.stringify: SUCCESS');
      console.log(`Result length: ${directJson.length} characters`);
    } catch (error) {
      console.error('Direct JSON.stringify: FAILED', error);
    }
    
    // 2. Test with manual date conversion
    try {
      // Convert dates to ISO strings
      const manuallyPrepared = {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        scenes: project.scenes.map(scene => ({
          ...scene,
          createdAt: scene.createdAt.toISOString(),
          updatedAt: scene.updatedAt.toISOString(),
          elements: scene.elements.map(element => ({
            ...element,
            createdAt: element.createdAt.toISOString(),
            updatedAt: element.updatedAt.toISOString(),
          })),
        })),
      };
      
      const manualJson = JSON.stringify(manuallyPrepared);
      console.log('Manual date conversion: SUCCESS');
      console.log(`Result length: ${manualJson.length} characters`);
    } catch (error) {
      console.error('Manual date conversion: FAILED', error);
    }
    
    // 3. Test with SuperJSON
    try {
      const superJsonResult = superjson.stringify(project);
      console.log('SuperJSON stringify: SUCCESS');
      console.log(`Result length: ${superJsonResult.length} characters`);
      
      // Test parsing back
      const parsed = superjson.parse(superJsonResult);
      console.log('SuperJSON parse: SUCCESS');
      
      // Add type assertion or check if parsed has createdAt property
      if (parsed && typeof parsed === 'object' && 'createdAt' in parsed) {
        console.log('Parsed object has dates?', parsed.createdAt instanceof Date);
      } else {
        console.log('Parsed object does not have a createdAt property');
      }
    } catch (error) {
      console.error('SuperJSON processing: FAILED', error);
    }
    
    // Check for potential circular references
    let circularPaths: string[] = [];
    findCircularReferences(project, '', circularPaths);
    
    if (circularPaths.length > 0) {
      console.log('WARNING: Circular references found at paths:');
      circularPaths.forEach(path => console.log(`- ${path}`));
    } else {
      console.log('No circular references found');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to detect circular references in an object
function findCircularReferences(obj: any, path: string, result: string[]) {
  // Keep track of objects we've seen
  const seen = new WeakSet();
  
  function detect(obj: any, path: string) {
    if (obj && typeof obj === 'object') {
      if (seen.has(obj)) {
        result.push(path);
        return;
      }
      
      seen.add(obj);
      
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        detect(value, path ? `${path}.${key}` : key);
      }
    }
  }
  
  detect(obj, path);
}

// Run the test
testSerialization();