import { BulkVideoGenerator } from '../src/app/utils/bulk-video/bulk-generator';

// Test category image detection based on productImageUrl
async function testCategoryDetection() {
  console.log('Testing category image detection based on productImageUrl...\n');

  const generator = new BulkVideoGenerator();
  
  // Test cases
  const testCases = [
    {
      name: 'Product with image URL',
      textContent: 'Premium Headphones',
      productImageUrl: 'https://example.com/headphones.jpg',
      expectCategory: false
    },
    {
      name: 'Category - null productImageUrl',
      textContent: 'Electronics Category',
      productImageUrl: null,
      expectCategory: true
    },
    {
      name: 'Category - empty string productImageUrl',
      textContent: 'Kitchen Appliances',
      productImageUrl: '',
      expectCategory: true
    },
    {
      name: 'Category - whitespace only productImageUrl',
      textContent: 'Home Decor',
      productImageUrl: '   ',
      expectCategory: true
    },
    {
      name: 'Product with S3 URL',
      textContent: 'Luxury Watch',
      productImageUrl: 'https://s3.wasabisys.com/bucket/watch.jpg',
      expectCategory: false
    }
  ];

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log(`Product Image URL: "${testCase.productImageUrl}"`);
    console.log(`Expected Category: ${testCase.expectCategory}`);
    
    try {
      const prompt = await (generator as any).generateScenePrompt(
        testCase.textContent,
        testCase.productImageUrl,
        'modern product photography',
        0,
        1,
        { name: 'Test Project' },
        null,
        null
      );
      
      // Check if the prompt generation logged category detection
      console.log(`Generated prompt preview: ${prompt.substring(0, 100)}...`);
      console.log(`✅ Test completed`);
    } catch (error) {
      console.error(`❌ Test failed:`, error);
    }
  }
}

testCategoryDetection().catch(console.error);