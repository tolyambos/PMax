import { BulkVideoGenerator } from '../src/app/utils/bulk-video/bulk-generator';

// Test the super minimalist preset detection
async function testSuperMinimal() {
  console.log('Testing super minimalist preset detection...\n');

  const generator = new BulkVideoGenerator();
  
  // Test cases
  const testCases = [
    {
      name: 'Super minimalist preset',
      presetId: 'super-minimalist',
      imageStyle: 'clean modern',
      expected: true
    },
    {
      name: 'Super minimal in style text',
      presetId: null,
      imageStyle: 'super minimal product photography',
      expected: true
    },
    {
      name: 'Product only with solid background',
      presetId: null,
      imageStyle: 'product only on solid white background',
      expected: true
    },
    {
      name: 'Regular minimalist',
      presetId: 'minimalist-product',
      imageStyle: 'minimalist style',
      expected: false
    },
    {
      name: 'Luxury style',
      presetId: 'luxury-product',
      imageStyle: 'luxury premium',
      expected: false
    }
  ];

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log(`PresetId: ${testCase.presetId || 'none'}`);
    console.log(`ImageStyle: ${testCase.imageStyle}`);
    
    // The generateScenePrompt method will log if super minimalist is detected
    const prompt = await (generator as any).generateScenePrompt(
      'Sample Product',
      null,
      testCase.imageStyle,
      0,
      1,
      { name: 'Test Project' },
      null,
      testCase.presetId
    );
    
    console.log(`Generated prompt: ${prompt.substring(0, 150)}...`);
    
    const isSuperMinimal = prompt.includes('no props') && 
                          prompt.includes('no environment') && 
                          prompt.includes('no additional elements');
    
    console.log(`Is super minimal: ${isSuperMinimal} (expected: ${testCase.expected})`);
    console.log(`✅ Test ${isSuperMinimal === testCase.expected ? 'PASSED' : 'FAILED'}`);
  }
}

testSuperMinimal().catch(console.error);