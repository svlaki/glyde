// Test the agent API directly
const TEST_USER_ID = 'ad32cecc-b52f-4afa-9360-3ead4a3bda85';
const API_URL = 'http://localhost:8000';

async function testAgentAPI() {
  console.log('🧪 Testing Agent API\n');
  
  try {
    // Test 1: Clear tomorrow's events
    console.log('1️⃣ Clearing tomorrow\'s events...');
    const clearResponse = await fetch(`${API_URL}/api/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          userId: TEST_USER_ID,
          sessionId: 'test-' + Date.now()
        },
        message: 'Delete all events tomorrow'
      })
    });
    
    const clearResult = await clearResponse.json();
    console.log('Response:', clearResult.content || clearResult.response || 'No response');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Create an event
    console.log('\n2️⃣ Creating a test event...');
    const createResponse = await fetch(`${API_URL}/api/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          userId: TEST_USER_ID,
          sessionId: 'test-' + Date.now()
        },
        message: 'Schedule a demo meeting tomorrow at 2pm',
      })
    });
    
    const createResult = await createResponse.json();
    console.log('Response:', createResult.content || createResult.response || 'No response');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 3: Create a conflicting event
    console.log('\n3️⃣ Testing conflict detection...');
    const conflictResponse = await fetch(`${API_URL}/api/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          userId: TEST_USER_ID,
          sessionId: 'test-' + Date.now()
        },
        message: 'Add another meeting tomorrow at 2pm',
      })
    });
    
    const conflictResult = await conflictResponse.json();
    console.log('Response:', conflictResult.content || conflictResult.response || 'No response');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 4: List events
    console.log('\n4️⃣ Listing tomorrow\'s events...');
    const listResponse = await fetch(`${API_URL}/api/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          userId: TEST_USER_ID,
          sessionId: 'test-' + Date.now()
        },
        message: 'What events do I have tomorrow?',
      })
    });
    
    const listResult = await listResponse.json();
    console.log('Response:', listResult.content || listResult.response || 'No response');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 5: Find free time
    console.log('\n5️⃣ Finding free time...');
    const freeTimeResponse = await fetch(`${API_URL}/api/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          userId: TEST_USER_ID,
          sessionId: 'test-' + Date.now()
        },
        message: 'Find me 30 minutes of free time tomorrow',
      })
    });
    
    const freeTimeResult = await freeTimeResponse.json();
    console.log('Response:', freeTimeResult.content || freeTimeResult.response || 'No response');
    
    console.log('\n✨ All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run the test
testAgentAPI();