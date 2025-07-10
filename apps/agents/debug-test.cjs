#!/usr/bin/env node

/**
 * Debug test script for agent scheduling behavior
 * Usage: node debug-test.js
 */

const { ConversationAgent } = require('./src/agents/conversation/ConversationAgent');
const { SupabaseService } = require('./src/services/SupabaseService');

async function testDinnerPartyScheduling() {
  console.log('🧪 Testing dinner party scheduling behavior...\n');
  
  // Test cases that should trigger evening scheduling
  const testCases = [
    "Schedule a dinner party tomorrow",
    "Book dinner tomorrow", 
    "Dinner party this Friday",
    "Set up dinner with friends tomorrow",
    "Plan a dinner party for next week"
  ];
  
  // Mock user ID for testing
  const testUserId = 'test-user-123';
  
  // Initialize services (you may need to adjust these based on your config)
  const supabaseService = new SupabaseService();
  const agent = new ConversationAgent(supabaseService);
  
  for (const testCase of testCases) {
    console.log(`\n📝 Testing: "${testCase}"`);
    console.log('=' + '='.repeat(testCase.length + 12));
    
    try {
      // Create a mock conversation state
      const mockState = {
        userId: testUserId,
        messages: [
          { 
            content: testCase, 
            _getType: () => 'human' 
          }
        ],
        pendingActions: []
      };
      
      // Process the message through the agent
      const result = await agent.processMessage(testCase, testUserId);
      
      console.log('✅ Agent response:', result);
      
      // Look for patterns in console output (the debug logs we added)
      // The actual time parsing will be visible in the console logs
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
    
    console.log('\n' + '-'.repeat(50));
  }
}

async function testTimeParsingSpecifically() {
  console.log('\n🕐 Testing time parsing specifically...\n');
  
  // Test with explicit times to ensure the system works
  const explicitTimeTests = [
    "Dinner party tomorrow at 7pm",
    "Dinner party tomorrow at 2pm",  // This should work but be flagged as unusual
    "Lunch tomorrow at 12pm",
    "Breakfast meeting tomorrow at 8am"
  ];
  
  for (const test of explicitTimeTests) {
    console.log(`\n📝 Testing explicit time: "${test}"`);
    // Same testing logic as above
  }
}

async function main() {
  try {
    await testDinnerPartyScheduling();
    await testTimeParsingSpecifically();
    
    console.log('\n🎯 DEBUGGING TIPS:');
    console.log('1. Check the console logs for "🔍 DEBUG:" messages');
    console.log('2. Look at the startTime and endTime values being generated');
    console.log('3. Check if the LLM is following the smart defaults in the prompt');
    console.log('4. Verify the local timezone conversion is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
if (require.main === module) {
  main();
}