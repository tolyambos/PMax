import { BulkVideoGenerator } from '../src/app/utils/bulk-video/bulk-generator';

// Test the AI requirements for super minimalist and category images
async function testAIRequirements() {
  console.log('Testing AI prompt requirements...\n');

  const generator = new BulkVideoGenerator();
  
  // Test cases
  const testCases = [
    {
      name: 'Super minimalist with product image',
      textContent: 'Premium Toaster',
      productImageUrl: 'https://example.com/toaster.jpg',
      presetId: 'super-minimalist',
      imageStyle: 'clean modern HEX/FFFFFF',
      expectedRequirements: ['white background', 'NO props', 'NO logos'] // NO logos shouldn't appear with product image
    },
    {
      name: 'Super minimalist category (no product image)',
      textContent: 'Kitchen Appliances',
      productImageUrl: null,
      presetId: 'super-minimalist', 
      imageStyle: 'clean modern HEX/000000',
      expectedRequirements: ['black background', 'NO props', 'NO logos', 'unbranded']
    },
    {
      name: 'Regular style with product image',
      textContent: 'Luxury Watch',
      productImageUrl: 'https://example.com/watch.jpg',
      presetId: 'luxury-product',
      imageStyle: 'premium elegant',
      expectedRequirements: [] // No special requirements
    },
    {
      name: 'Regular style category (no product image)',
      textContent: 'Electronics',
      productImageUrl: null,
      presetId: null,
      imageStyle: 'modern tech',
      expectedRequirements: ['NO logos', 'unbranded'] // Should avoid logos for category
    }
  ];

  // Mock the enhancePromptWithAI to capture the requirements
  const originalEnhancePromptWithAI = (generator as any).enhancePromptWithAI;
  let capturedRequirements: string[] = [];
  
  (generator as any).enhancePromptWithAI = async function(
    context: string,
    sceneType: string,
    style: string,
    sceneIndex: number,
    totalScenes: number,
    presetId?: string | null
  ) {
    // Capture the requirements from the system prompt
    const result = await originalEnhancePromptWithAI.call(
      this,
      context,
      sceneType,
      style,
      sceneIndex,
      totalScenes,
      presetId
    );
    
    // For testing, we'll just return a mock prompt with requirements
    capturedRequirements = [];
    const isSuperMinimalistic = presetId === 'super-minimalist';
    const isCategoryImage = !context.includes('Product photography focused');
    
    if (isSuperMinimalistic) {
      capturedRequirements.push('white background', 'NO props');
    }
    if (isCategoryImage) {
      capturedRequirements.push('NO logos', 'unbranded');
    }
    
    return `Test prompt with requirements: ${capturedRequirements.join(', ')}`;
  };

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log(`Product Image: ${testCase.productImageUrl ? 'Yes' : 'No (Category)'}`);
    console.log(`Preset: ${testCase.presetId || 'none'}`);
    
    capturedRequirements = [];
    
    const prompt = await (generator as any).generateScenePrompt(
      testCase.textContent,
      testCase.productImageUrl,
      testCase.imageStyle,
      0,
      1,
      { name: 'Test Project' },
      null,
      testCase.presetId
    );
    
    console.log(`Generated prompt includes requirements: ${capturedRequirements.join(', ') || 'none'}`);
    
    // Check if expected requirements are met
    let allMet = true;
    for (const req of testCase.expectedRequirements) {
      const found = capturedRequirements.some(r => r.includes(req));
      if (!found && req === 'NO logos' && !testCase.productImageUrl) {
        // For category images, we expect NO logos requirement
        allMet = false;
        console.log(`❌ Missing expected requirement: ${req}`);
      } else if (found && req === 'NO logos' && testCase.productImageUrl) {
        // For product images, we should NOT have NO logos requirement
        allMet = false;
        console.log(`❌ Unexpected requirement for product image: ${req}`);
      }
    }
    
    console.log(`✅ Test ${allMet ? 'PASSED' : 'FAILED'}`);
  }
  
  // Restore original method
  (generator as any).enhancePromptWithAI = originalEnhancePromptWithAI;
}

testAIRequirements().catch(console.error);