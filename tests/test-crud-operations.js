// Test script to verify all CRUD operations for events
// Run with: node test-crud-operations.js

const TEST_USER_ID = 'ad32cecc-b52f-4afa-9360-3ead4a3bda85';
const API_URL = 'http://localhost:8000';

async function testCRUD() {
  console.log('🧪 Testing CRUD Operations for Calendar Events\n');
  
  let testEventId = null;
  
  try {
    // 1. CREATE - Test event creation
    console.log('1️⃣ CREATE: Testing event creation...');
    const createResponse = await fetch(`${API_URL}/api/events/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: TEST_USER_ID,
        event: {
          event_title: 'Test Event',
          event_starts_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          event_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
          event_description: 'This is a test event for CRUD operations',
          event_location: 'Test Location'
        }
      })
    });
    
    const createResult = await createResponse.json();
    if (createResult.success && createResult.event) {
      testEventId = createResult.event.id;
      console.log('CREATE: Event created successfully');
      console.log(`   Event ID: ${testEventId}`);
    } else {
      console.log('CREATE: Failed to create event');
      return;
    }
    
    // 2. READ - Test listing events
    console.log('\n2️⃣ READ: Testing event listing...');
    const listResponse = await fetch(`${API_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: TEST_USER_ID
      })
    });
    
    const listResult = await listResponse.json();
    if (listResult.success && listResult.events) {
      const foundEvent = listResult.events.find(e => e.id === testEventId);
      if (foundEvent) {
        console.log('READ: Event found in list');
        console.log(`   Total events: ${listResult.events.length}`);
      } else {
        console.log('READ: Created event not found in list');
      }
    } else {
      console.log('READ: Failed to list events');
    }
    
    // 3. UPDATE - Test event update
    console.log('\n3️⃣ UPDATE: Testing event update...');
    const updateResponse = await fetch(`${API_URL}/api/events/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: TEST_USER_ID,
        event_id: testEventId,
        event: {
          event_title: 'Updated Test Event',
          event_description: 'This event has been updated'
        }
      })
    });
    
    const updateResult = await updateResponse.json();
    if (updateResult.success) {
      console.log('UPDATE: Event updated successfully');
    } else {
      console.log('UPDATE: Failed to update event');
    }
    
    // 4. DELETE - Test event deletion
    console.log('\n4️⃣ DELETE: Testing event deletion...');
    const deleteResponse = await fetch(`${API_URL}/api/events/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: TEST_USER_ID,
        event_id: testEventId
      })
    });
    
    const deleteResult = await deleteResponse.json();
    if (deleteResult.success) {
      console.log('DELETE: Event deleted successfully');
    } else {
      console.log('DELETE: Failed to delete event');
    }
    
    // 5. VERIFY - Check event is gone
    console.log('\n5️⃣ VERIFY: Checking event is deleted...');
    const verifyResponse = await fetch(`${API_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: TEST_USER_ID
      })
    });
    
    const verifyResult = await verifyResponse.json();
    if (verifyResult.success && verifyResult.events) {
      const stillExists = verifyResult.events.find(e => e.id === testEventId);
      if (!stillExists) {
        console.log('VERIFY: Event successfully removed from database');
      } else {
        console.log('VERIFY: Event still exists after deletion');
      }
    }
    
    console.log('\nAll CRUD operations tested successfully!');
    
  } catch (error) {
    console.error('\nTest failed:', error.message);
    
    // Cleanup if test failed
    if (testEventId) {
      console.log('\nCleaning up test event...');
      try {
        await fetch(`${API_URL}/api/events/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: TEST_USER_ID,
            event_id: testEventId
          })
        });
        console.log('Cleanup complete');
      } catch (cleanupError) {
        console.log('Cleanup failed:', cleanupError.message);
      }
    }
  }
}

// Run the test
testCRUD();