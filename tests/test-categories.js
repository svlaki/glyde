// Test category system
const TEST_USER_ID = 'ad32cecc-b52f-4afa-9360-3ead4a3bda85';
const API_URL = 'http://localhost:8000';

async function testCategories() {
  console.log('🧪 Testing Category System\n');
  
  const testEvents = [
    'Create a meeting with the team tomorrow at 2pm',
    'Schedule gym workout tomorrow at 6am',
    'Add lunch with Sarah tomorrow at noon',
    'Create study session for React tomorrow at 4pm',
    'Schedule doctor appointment tomorrow at 10am',
    'Add budget review tomorrow at 3pm',
    'Book flight to NYC next week',
    'Morning routine tomorrow at 7am'
  ];
  
  for (const message of testEvents) {
    console.log(`\n📝 Testing: "${message}"`);
    
    try {
      const response = await fetch(`${API_URL}/api/agent/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            userId: TEST_USER_ID,
            sessionId: 'test-categories-' + Date.now()
          },
          message: message
        })
      });
      
      const result = await response.json();
      console.log('✅ Response:', result.content || 'Created');
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
  
  console.log('\n🎉 Category testing completed!');
}

// Run the test
testCategories();