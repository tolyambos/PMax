import { BulkVideoGenerator } from '../src/app/utils/bulk-video/bulk-generator';

// Test the super minimalist preset with color names
async function testSuperMinimalColors() {
  console.log('Testing super minimalist with color names...\n');

  const generator = new BulkVideoGenerator();
  
  // Test cases with different color specifications
  const testCases = [
    {
      name: 'Default white background',
      presetId: 'super-minimalist',
      imageStyle: 'clean modern',
      expectedColor: 'white'
    },
    {
      name: 'HEX color black',
      presetId: 'super-minimalist',
      imageStyle: 'clean modern HEX/000000',
      expectedColor: 'black'
    },
    {
      name: 'HEX color red',
      presetId: 'super-minimalist',
      imageStyle: 'clean modern HEX#FF0000',
      expectedColor: 'red'
    },
    {
      name: 'HEX color custom',
      presetId: 'super-minimalist',
      imageStyle: 'clean modern HEX/123456',
      expectedColor: 'solid color' // Unknown hex should default to 'solid color'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log(`PresetId: ${testCase.presetId}`);
    console.log(`ImageStyle: ${testCase.imageStyle}`);
    
    const prompt = await (generator as any).generateScenePrompt(
      'Toaster',
      null,
      testCase.imageStyle,
      0,
      1,
      { name: 'Test Project' },
      null,
      testCase.presetId
    );
    
    console.log(`Generated prompt: ${prompt}`);
    
    const hasColorName = prompt.includes(`on ${testCase.expectedColor} background`);
    const hasColorWord = prompt.includes(`solid ${testCase.expectedColor} background`);
    
    console.log(`✅ Test ${(hasColorName && hasColorWord) ? 'PASSED' : 'FAILED'}: Contains "${testCase.expectedColor}" color name`);
  }
}

testSuperMinimalColors().catch(console.error);