// Test temporal understanding
const TEST_USER_ID = 'ad32cecc-b52f-4afa-9360-3ead4a3bda85';
const API_URL = 'http://localhost:8000';

async function testTemporal() {
  console.log('🧪 Testing Temporal Understanding\n');
  
  try {
    // First, create some events for testing
    console.log('Setting up test events...');
    
    // Create a morning event tomorrow
    const morningResponse = await fetch(`${API_URL}/api/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          userId: TEST_USER_ID,
          sessionId: 'test-temporal-' + Date.now()
        },
        message: 'Create a "Morning Standup" event tomorrow at 9am'
      })
    });
    
    const morningResult = await morningResponse.json();
    console.log('Morning event:', morningResult.content?.substring(0, 100) || 'Created');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create an afternoon event tomorrow
    const afternoonResponse = await fetch(`${API_URL}/api/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          userId: TEST_USER_ID,
          sessionId: 'test-temporal-' + Date.now()
        },
        message: 'Schedule "Lunch with Team" tomorrow at 1pm'
      })
    });
    
    const afternoonResult = await afternoonResponse.json();
    console.log('Afternoon event:', afternoonResult.content?.substring(0, 100) || 'Created');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Now test temporal queries
    console.log('\n📝 Testing temporal queries...\n');
    
    // Test 1: Ask about tomorrow morning
    console.log('1️⃣ Testing "tomorrow morning"...');
    const morningQueryResponse = await fetch(`${API_URL}/api/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          userId: TEST_USER_ID,
          sessionId: 'test-temporal-' + Date.now()
        },
        message: 'What do I have tomorrow morning?'
      })
    });
    
    const morningQuery = await morningQueryResponse.json();
    console.log('Response:', morningQuery.content || 'No response');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Ask about tomorrow afternoon
    console.log('\n2️⃣ Testing "tomorrow afternoon"...');
    const afternoonQueryResponse = await fetch(`${API_URL}/api/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          userId: TEST_USER_ID,
          sessionId: 'test-temporal-' + Date.now()
        },
        message: 'What meetings do I have tomorrow afternoon?'
      })
    });
    
    const afternoonQuery = await afternoonQueryResponse.json();
    console.log('Response:', afternoonQuery.content || 'No response');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Ask about specific event with temporal reference
    console.log('\n3️⃣ Testing "tomorrow morning meeting"...');
    const specificQueryResponse = await fetch(`${API_URL}/api/agent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          userId: TEST_USER_ID,
          sessionId: 'test-temporal-' + Date.now()
        },
        message: 'What time is my tomorrow morning meeting?'
      })
    });
    
    const specificQuery = await specificQueryResponse.json();
    console.log('Response:', specificQuery.content || 'No response');
    
    console.log('\n✨ Temporal testing completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run the test
testTemporal();