import React, { useState } from 'react';
import { useInteractions } from '../lib/interactionContext';
import { useAuth } from '../lib/authContext';

interface TestScenario {
  id: string;
  name: string;
  description: string;
  category: 'calendar' | 'nlp' | 'intelligence' | 'stress' | 'edge_cases';
  actions: TestAction[];
}

interface TestAction {
  type: 'chat' | 'interaction' | 'event' | 'analyze' | 'verify';
  data: any;
  delay?: number; // Milliseconds to wait after action
  expectedResult?: string; // For verification
}

interface TestResult {
  scenarioId: string;
  scenarioName: string;
  status: 'pass' | 'fail' | 'partial';
  duration: number;
  actions: {
    action: string;
    status: 'pass' | 'fail' | 'skip';
    message?: string;
  }[];
  timestamp: string;
}

const TEST_SCENARIOS: TestScenario[] = [
  // DEMO SCENARIO - Shows all features
  {
    id: 'comprehensive-demo',
    name: '🎯 Full Feature Demo',
    description: 'Demonstrates all system capabilities',
    category: 'calendar',
    actions: [
      {
        type: 'chat',
        data: { message: 'Clear all my events for tomorrow' },
        delay: 2000,
        expectedResult: 'events_cleared'
      },
      {
        type: 'chat',
        data: { message: 'Schedule a morning standup tomorrow at 9am' },
        delay: 2000,
        expectedResult: 'event_created'
      },
      {
        type: 'chat',
        data: { message: 'Add a project review tomorrow at 10:30am for 1 hour' },
        delay: 2000,
        expectedResult: 'event_created'
      },
      {
        type: 'chat',
        data: { message: 'Schedule lunch with the team tomorrow at noon at the cafeteria' },
        delay: 2000,
        expectedResult: 'event_created'
      },
      {
        type: 'chat',
        data: { message: 'Block 2 hours tomorrow afternoon for deep work' },
        delay: 2000,
        expectedResult: 'event_created'
      },
      {
        type: 'chat',
        data: { message: 'Add a client call tomorrow at 4pm' },
        delay: 2000,
        expectedResult: 'event_created'
      },
      {
        type: 'chat',
        data: { message: 'Schedule another meeting tomorrow at 4pm to test conflicts' },
        delay: 2000,
        expectedResult: 'conflict_detected'
      },
      {
        type: 'chat',
        data: { message: 'What is my schedule for tomorrow?' },
        delay: 2000,
        expectedResult: 'schedule_listed'
      },
      {
        type: 'chat',
        data: { message: 'Find me 30 minutes of free time tomorrow' },
        delay: 2000,
        expectedResult: 'free_time_found'
      },
      {
        type: 'chat',
        data: { message: 'Give me a daily briefing for tomorrow' },
        delay: 2000,
        expectedResult: 'briefing_generated'
      }
    ]
  },
  // Calendar Basic Operations
  {
    id: 'basic-event-creation',
    name: 'Basic Event Creation',
    description: 'Test creating a simple calendar event',
    category: 'calendar',
    actions: [
      {
        type: 'chat',
        data: { message: 'Schedule a team meeting tomorrow at 2pm' },
        delay: 1000,
        expectedResult: 'event_created'
      }
    ]
  },
  {
    id: 'event-with-details',
    name: 'Detailed Event Creation',
    description: 'Create an event with location and description',
    category: 'calendar',
    actions: [
      {
        type: 'chat',
        data: { message: 'Add lunch with John at Starbucks on Main Street tomorrow at noon for 90 minutes' },
        delay: 1000,
        expectedResult: 'event_created_with_details'
      }
    ]
  },
  {
    id: 'event-modification',
    name: 'Event Modification',
    description: 'Test updating existing events',
    category: 'calendar',
    actions: [
      {
        type: 'chat',
        data: { message: 'Create a test meeting tomorrow at 10am' },
        delay: 1500
      },
      {
        type: 'chat',
        data: { message: 'Move the test meeting to 3pm' },
        delay: 1500,
        expectedResult: 'event_updated'
      }
    ]
  },
  {
    id: 'event-deletion',
    name: 'Event Deletion',
    description: 'Test deleting events',
    category: 'calendar',
    actions: [
      {
        type: 'chat',
        data: { message: 'Create a temporary event tomorrow at 4pm' },
        delay: 1500
      },
      {
        type: 'chat',
        data: { message: 'Delete the temporary event' },
        delay: 1500,
        expectedResult: 'event_deleted'
      }
    ]
  },
  {
    id: 'list-events',
    name: 'List Events',
    description: 'Test listing calendar events',
    category: 'calendar',
    actions: [
      {
        type: 'chat',
        data: { message: 'What events do I have tomorrow?' },
        delay: 1000,
        expectedResult: 'events_listed'
      },
      {
        type: 'chat',
        data: { message: 'Show me my schedule for next week' },
        delay: 1000,
        expectedResult: 'weekly_schedule'
      }
    ]
  },

  // Natural Language Processing Tests
  {
    id: 'nlp-relative-dates',
    name: 'Relative Date Parsing',
    description: 'Test understanding of relative dates',
    category: 'nlp',
    actions: [
      {
        type: 'chat',
        data: { message: 'Schedule a call next Monday at 10am' },
        delay: 1500
      },
      {
        type: 'chat',
        data: { message: 'Add a meeting the day after tomorrow at 2pm' },
        delay: 1500
      },
      {
        type: 'chat',
        data: { message: 'Block time for deep work this Friday afternoon' },
        delay: 1500
      }
    ]
  },
  {
    id: 'nlp-time-variations',
    name: 'Time Format Variations',
    description: 'Test different time format inputs',
    category: 'nlp',
    actions: [
      {
        type: 'chat',
        data: { message: 'Meeting at 14:00 tomorrow' },
        delay: 1500
      },
      {
        type: 'chat',
        data: { message: 'Lunch at half past noon on Wednesday' },
        delay: 1500
      },
      {
        type: 'chat',
        data: { message: 'Call at quarter to 3 in the afternoon' },
        delay: 1500
      }
    ]
  },
  {
    id: 'nlp-complex-commands',
    name: 'Complex Commands',
    description: 'Test understanding of complex natural language',
    category: 'nlp',
    actions: [
      {
        type: 'chat',
        data: { message: 'Every Tuesday at 9am, schedule a team standup for 30 minutes' },
        delay: 2000
      },
      {
        type: 'chat',
        data: { message: 'Find 2 hours for focused work between my meetings tomorrow' },
        delay: 2000
      },
      {
        type: 'chat',
        data: { message: 'Schedule a 1-on-1 with Sarah, preferably in the morning when I\'m free' },
        delay: 2000
      }
    ]
  },

  // Intelligence Features
  {
    id: 'conflict-detection',
    name: 'Conflict Detection',
    description: 'Test calendar conflict detection',
    category: 'intelligence',
    actions: [
      {
        type: 'chat',
        data: { message: 'Schedule a meeting tomorrow at 2pm' },
        delay: 1500
      },
      {
        type: 'chat',
        data: { message: 'Add another meeting tomorrow at 2pm' },
        delay: 1500,
        expectedResult: 'conflict_detected'
      }
    ]
  },
  {
    id: 'smart-scheduling',
    name: 'Smart Scheduling',
    description: 'Test intelligent scheduling suggestions',
    category: 'intelligence',
    actions: [
      {
        type: 'chat',
        data: { message: 'Schedule 3 meetings tomorrow: team sync (30 min), project review (1 hour), and client call (45 min)' },
        delay: 2000
      },
      {
        type: 'chat',
        data: { message: 'Find the best time for a 2-hour deep work session this week' },
        delay: 2000
      }
    ]
  },
  {
    id: 'free-time-finder',
    name: 'Free Time Finder',
    description: 'Test finding available time slots',
    category: 'intelligence',
    actions: [
      {
        type: 'chat',
        data: { message: 'When am I free tomorrow?' },
        delay: 1500
      },
      {
        type: 'chat',
        data: { message: 'Find 30 minutes for a quick call this afternoon' },
        delay: 1500
      },
      {
        type: 'chat',
        data: { message: 'What\'s my next available slot for a 1-hour meeting?' },
        delay: 1500
      }
    ]
  },
  {
    id: 'daily-briefing',
    name: 'Daily Briefing',
    description: 'Test daily summary and insights',
    category: 'intelligence',
    actions: [
      {
        type: 'chat',
        data: { message: 'Give me a summary of today' },
        delay: 1500
      },
      {
        type: 'chat',
        data: { message: 'What should I focus on today?' },
        delay: 1500
      },
      {
        type: 'chat',
        data: { message: 'How busy is my week looking?' },
        delay: 1500
      }
    ]
  },

  // Stress Tests
  {
    id: 'bulk-event-creation',
    name: 'Bulk Event Creation',
    description: 'Test creating multiple events rapidly',
    category: 'stress',
    actions: [
      {
        type: 'chat',
        data: { message: 'Add meeting 1 tomorrow at 9am' },
        delay: 500
      },
      {
        type: 'chat',
        data: { message: 'Add meeting 2 tomorrow at 10am' },
        delay: 500
      },
      {
        type: 'chat',
        data: { message: 'Add meeting 3 tomorrow at 11am' },
        delay: 500
      },
      {
        type: 'chat',
        data: { message: 'Add meeting 4 tomorrow at 2pm' },
        delay: 500
      },
      {
        type: 'chat',
        data: { message: 'Add meeting 5 tomorrow at 3pm' },
        delay: 500
      }
    ]
  },
  {
    id: 'rapid-updates',
    name: 'Rapid Updates',
    description: 'Test system with rapid event updates',
    category: 'stress',
    actions: [
      {
        type: 'chat',
        data: { message: 'Create stress test event tomorrow at noon' },
        delay: 1000
      },
      {
        type: 'chat',
        data: { message: 'Move stress test event to 1pm' },
        delay: 500
      },
      {
        type: 'chat',
        data: { message: 'Move stress test event to 2pm' },
        delay: 500
      },
      {
        type: 'chat',
        data: { message: 'Move stress test event to 3pm' },
        delay: 500
      },
      {
        type: 'chat',
        data: { message: 'Delete stress test event' },
        delay: 500
      }
    ]
  },

  // Edge Cases
  {
    id: 'edge-invalid-dates',
    name: 'Invalid Date Handling',
    description: 'Test handling of invalid date inputs',
    category: 'edge_cases',
    actions: [
      {
        type: 'chat',
        data: { message: 'Schedule meeting on February 30th' },
        delay: 1500,
        expectedResult: 'error_invalid_date'
      },
      {
        type: 'chat',
        data: { message: 'Add event yesterday at 2pm' },
        delay: 1500,
        expectedResult: 'error_past_date'
      }
    ]
  },
  {
    id: 'edge-ambiguous-input',
    name: 'Ambiguous Input Handling',
    description: 'Test handling of ambiguous commands',
    category: 'edge_cases',
    actions: [
      {
        type: 'chat',
        data: { message: 'Schedule that thing we talked about' },
        delay: 1500,
        expectedResult: 'clarification_needed'
      },
      {
        type: 'chat',
        data: { message: 'Move it to tomorrow' },
        delay: 1500,
        expectedResult: 'context_required'
      }
    ]
  },
  {
    id: 'edge-overlapping-events',
    name: 'Overlapping Events',
    description: 'Test handling of overlapping time slots',
    category: 'edge_cases',
    actions: [
      {
        type: 'chat',
        data: { message: 'Schedule a 3-hour workshop tomorrow at 1pm' },
        delay: 1500
      },
      {
        type: 'chat',
        data: { message: 'Add a quick call tomorrow at 2:30pm' },
        delay: 1500,
        expectedResult: 'overlap_warning'
      }
    ]
  }
];

export function DevTestPanel() {
  // Add CSS to ensure full opacity
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .dev-test-panel-solid {
        background-color: #000000 !important;
        color: #ffffff !important;
        opacity: 1 !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      .dev-test-panel-header {
        background-color: #1a1a1a !important;
        color: #ffffff !important;
        opacity: 1 !important;
      }
      .dev-test-panel-content {
        background-color: #000000 !important;
        color: #ffffff !important;
        opacity: 1 !important;
      }
      .dev-test-panel-solid * {
        color: #ffffff !important;
      }
      .dev-test-panel-solid button {
        color: #ffffff !important;
      }
      .dev-test-panel-solid .text-green-400 {
        color: #4ade80 !important;
      }
      .dev-test-panel-solid .text-yellow-400 {
        color: #facc15 !important;
      }
      .dev-test-panel-solid .text-red-400 {
        color: #f87171 !important;
      }
      .dev-test-panel-solid .text-blue-400 {
        color: #60a5fa !important;
      }
      .dev-test-panel-solid .text-gray-400 {
        color: #9ca3af !important;
      }
      .dev-test-panel-solid .text-gray-300 {
        color: #d1d5db !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const [testResults, setTestResults] = useState<{[key: string]: TestResult}>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [currentTestIndex, setCurrentTestIndex] = useState<number>(0);
  const [totalTests, setTotalTests] = useState<number>(0);
  const [showOnCalendar, setShowOnCalendar] = useState(true);
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);
  const { addInteraction } = useInteractions();
  const { user, session } = useAuth();

  const runTestScenario = async (scenario: TestScenario): Promise<TestResult> => {
    if (!user || !session?.access_token) {
      console.error('User not authenticated');
      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        status: 'fail',
        duration: 0,
        actions: [{ action: 'auth', status: 'fail', message: 'Not authenticated' }],
        timestamp: new Date().toISOString()
      };
    }

    const startTime = Date.now();
    setIsRunning(true);
    setRunningScenarioId(scenario.id);
    setCurrentAction(`Running: ${scenario.name}`);
    const actionResults: any[] = [];
    let overallStatus: 'pass' | 'fail' | 'partial' = 'pass';

    for (const action of scenario.actions) {
      setCurrentAction(`${scenario.name}: ${action.type}`);
      
      try {
        let actionStatus: 'pass' | 'fail' | 'skip' = 'pass';
        let actionMessage = '';

        switch (action.type) {
          case 'chat':
            // Add test prefix to messages if NOT showing on calendar
            const testMessage = !showOnCalendar && !action.data.message.includes('[TEST]') 
              ? `[TEST] ${action.data.message}` 
              : action.data.message;
            
            // Use the correct agent endpoint with proper format
            const chatResponse = await fetch(`${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/agent/process`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                context: {
                  userId: user.id,
                  sessionId: `test-${scenario.id}-${Date.now()}`
                },
                message: testMessage
              })
            });
            
            const chatResult = await chatResponse.json();
            
            if (!chatResponse.ok) {
              actionStatus = 'fail';
              actionMessage = chatResult.error || 'Chat request failed';
              overallStatus = 'fail';
            } else {
              // Verify expected result if specified
              if (action.expectedResult) {
                // Simple check - in production, this would be more sophisticated
                let responseText = '';
                if (typeof chatResult.response === 'object' && chatResult.response?.content) {
                  responseText = String(chatResult.response.content).toLowerCase();
                } else if (typeof chatResult.response === 'string') {
                  responseText = chatResult.response.toLowerCase();
                } else if (chatResult.content) {
                  responseText = String(chatResult.content).toLowerCase();
                }
                
                if (action.expectedResult === 'event_created' && !responseText.includes('created') && !responseText.includes('scheduled')) {
                  actionStatus = 'fail';
                  actionMessage = 'Event creation not confirmed';
                  overallStatus = overallStatus === 'pass' ? 'partial' : overallStatus;
                }
              }
            }
            
            // Extract message content from response
            let messageContent = actionMessage;
            if (!messageContent) {
              if (typeof chatResult.response === 'object' && chatResult.response?.content) {
                messageContent = chatResult.response.content;
              } else if (typeof chatResult.response === 'string') {
                messageContent = chatResult.response;
              } else if (chatResult.content) {
                messageContent = chatResult.content;
              }
            }
            
            actionResults.push({
              action: `Chat: ${action.data.message}`,
              status: actionStatus,
              message: messageContent
            });
            break;

          case 'verify':
            // Verification action - check system state
            const verifyResponse = await fetch(`${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/events`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                user_id: user.id
              })
            });
            
            const verifyResult = await verifyResponse.json();
            
            actionResults.push({
              action: `Verify: ${action.data.check}`,
              status: verifyResult.success ? 'pass' : 'fail',
              message: `Found ${verifyResult.events?.length || 0} events`
            });
            break;

          case 'analyze':
            // Analysis action - for future pattern detection
            actionResults.push({
              action: `Analyze: ${action.data.prompt}`,
              status: 'skip',
              message: 'Analysis not yet implemented'
            });
            break;

          default:
            actionResults.push({
              action: action.type,
              status: 'skip',
              message: 'Unknown action type'
            });
        }

        if (action.delay) {
          await new Promise(resolve => setTimeout(resolve, action.delay));
        }
      } catch (error) {
        console.error(`Error in action ${action.type}:`, error);
        actionResults.push({
          action: action.type,
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        overallStatus = 'fail';
      }
    }

    const duration = Date.now() - startTime;
    const result: TestResult = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: overallStatus,
      duration,
      actions: actionResults,
      timestamp: new Date().toISOString()
    };

    setTestResults(prev => ({
      ...prev,
      [scenario.id]: result
    }));
    
    setCurrentAction('');
    setIsRunning(false);
    setRunningScenarioId(null);
    
    // Trigger calendar refresh if events were created
    if (showOnCalendar && scenario.category === 'calendar') {
      window.dispatchEvent(new CustomEvent('calendar-refresh'));
    }
    
    return result;
  };

  const runAllTests = async () => {
    setIsAutoMode(true);
    setTestResults({}); // Clear previous results
    const scenarios = selectedCategory === 'all' 
      ? TEST_SCENARIOS 
      : TEST_SCENARIOS.filter(s => s.category === selectedCategory);
    
    setTotalTests(scenarios.length);
    setCurrentTestIndex(0);
    
    for (let i = 0; i < scenarios.length; i++) {
      setCurrentTestIndex(i + 1);
      await runTestScenario(scenarios[i]);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between scenarios
    }
    
    setIsAutoMode(false);
    setCurrentTestIndex(0);
    setTotalTests(0);
    
    // Generate summary report
    generateTestReport();
  };

  const runCategoryTests = async (category: string) => {
    const scenarios = TEST_SCENARIOS.filter(s => s.category === category);
    for (const scenario of scenarios) {
      await runTestScenario(scenario);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  const generateTestReport = () => {
    const results = Object.values(testResults);
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const partial = results.filter(r => r.status === 'partial').length;
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        passed,
        failed,
        partial,
        successRate: results.length > 0 ? (passed / results.length * 100).toFixed(1) : 0
      },
      categories: {} as any,
      failures: results.filter(r => r.status === 'fail').map(r => ({
        scenario: r.scenarioName,
        failedActions: r.actions.filter(a => a.status === 'fail')
      }))
    };
    
    // Group by category
    ['calendar', 'nlp', 'intelligence', 'stress', 'edge_cases'].forEach(cat => {
      const catResults = results.filter(r => {
        const scenario = TEST_SCENARIOS.find(s => s.id === r.scenarioId);
        return scenario?.category === cat;
      });
      
      report.categories[cat] = {
        total: catResults.length,
        passed: catResults.filter(r => r.status === 'pass').length,
        failed: catResults.filter(r => r.status === 'fail').length
      };
    });
    
    console.log('📊 Test Report:', report);
    return report;
  };

  const clearTestData = async () => {
    if (!user || !session?.access_token) return;
    
    try {
      // Clear test events
      const response = await fetch(`${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ user_id: user.id })
      });
      
      const result = await response.json();
      if (result.success && result.events) {
        // Delete all test events (those with "test" in the title)
        for (const event of result.events) {
          if (event.event_title?.toLowerCase().includes('test') || 
              event.event_title?.toLowerCase().includes('meeting') ||
              event.event_title?.toLowerCase().includes('stress')) {
            await fetch(`${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/events/delete`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                user_id: user.id,
                event_id: event.id
              })
            });
          }
        }
      }
      
      setTestResults({});
      console.log('Test data cleared');
    } catch (error) {
      console.error('Error clearing test data:', error);
    }
  };

  if (!user) return null;

  const categories = ['all', 'calendar', 'nlp', 'intelligence', 'stress', 'edge_cases'];
  const categoryColors = {
    calendar: 'bg-blue-600',
    nlp: 'bg-green-600',
    intelligence: 'bg-purple-600',
    stress: 'bg-red-600',
    edge_cases: 'bg-yellow-600'
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${isOpen ? 'w-[550px]' : 'w-32'}`} style={{ isolation: 'isolate' }}>
      <div className="dev-test-panel-solid text-white rounded-lg shadow-2xl border border-gray-700">
        <div 
          className="dev-test-panel-header p-2 cursor-pointer flex justify-between items-center rounded-t-lg"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="text-xs font-mono">🧪 Dev Test Panel</span>
          <span className="text-xs">{isOpen ? '▼' : '▲'}</span>
        </div>
        
        {isOpen && (
          <div className="dev-test-panel-content p-3 max-h-[600px] overflow-y-auto">
            {/* Status Bar */}
            {isRunning && (
              <div className="mb-3 p-2 rounded text-xs" style={{ backgroundColor: '#1e3a8a' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="animate-spin mr-2 h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                    {currentAction}
                  </div>
                  {isAutoMode && totalTests > 0 && (
                    <div className="text-white text-xs">
                      Test {currentTestIndex} of {totalTests}
                    </div>
                  )}
                </div>
                {isAutoMode && totalTests > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-blue-800 rounded-full h-2">
                      <div 
                        className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(currentTestIndex / totalTests) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Test Summary */}
            {Object.keys(testResults).length > 0 && (
              <div className="mb-3 p-2 rounded text-xs" style={{ backgroundColor: '#1f1f1f' }}>
                <div className="font-semibold mb-1 flex items-center justify-between">
                  <span>Test Summary</span>
                  {isAutoMode && (
                    <span className="text-blue-400">
                      {Math.round((currentTestIndex / totalTests) * 100)}% Complete
                    </span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span>Total: {Object.keys(testResults).length}</span>
                  <span className="text-green-400">
                    ✓ Pass: {Object.values(testResults).filter(r => r.status === 'pass').length}
                  </span>
                  <span className="text-yellow-400">
                    ⚠ Partial: {Object.values(testResults).filter(r => r.status === 'partial').length}
                  </span>
                  <span className="text-red-400">
                    ✗ Fail: {Object.values(testResults).filter(r => r.status === 'fail').length}
                  </span>
                </div>
              </div>
            )}

            {/* Category Filter */}
            <div className="mb-3">
              <div className="text-xs font-semibold mb-1">Category Filter</div>
              <div className="flex flex-wrap gap-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      selectedCategory === cat 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {cat.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="mb-3">
              <div className="grid grid-cols-3 gap-2 mb-2">
                <button
                  onClick={runAllTests}
                  disabled={isRunning}
                  className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-xs font-medium transition-colors flex items-center justify-center"
                >
                  {isRunning && isAutoMode ? (
                    <>
                      <div className="animate-spin mr-1 h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                      Running...
                    </>
                  ) : (
                    '🚀 Run All'
                  )}
                </button>
                <button
                  onClick={generateTestReport}
                  disabled={Object.keys(testResults).length === 0}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-xs font-medium transition-colors"
                >
                  📊 Report
                </button>
                <button
                  onClick={clearTestData}
                  disabled={isRunning}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded text-xs font-medium transition-colors"
                >
                  🗑️ Clear
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={showOnCalendar}
                    onChange={(e) => setShowOnCalendar(e.target.checked)}
                    className="mr-1"
                  />
                  Show test events on calendar
                </label>
                {isRunning && !isAutoMode && (
                  <button
                    onClick={() => setIsRunning(false)}
                    className="px-2 py-0.5 bg-orange-600 hover:bg-orange-700 rounded text-xs"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>

            {/* Test Scenarios */}
            {['calendar', 'nlp', 'intelligence', 'stress', 'edge_cases'].map(category => {
              const categoryScenarios = TEST_SCENARIOS.filter(s => s.category === category);
              
              if (selectedCategory !== 'all' && selectedCategory !== category) {
                return null;
              }
              
              return (
                <div key={category} className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-xs font-semibold text-gray-300 uppercase">
                      {category.replace('_', ' ')}
                    </div>
                    <button
                      onClick={() => runCategoryTests(category)}
                      disabled={isRunning}
                      className={`px-2 py-0.5 ${categoryColors[category as keyof typeof categoryColors] || 'bg-gray-600'} hover:opacity-80 disabled:bg-gray-600 rounded text-xs transition-opacity`}
                    >
                      Run All
                    </button>
                  </div>
                  <div className="space-y-1">
                    {categoryScenarios.map(scenario => {
                      const result = testResults[scenario.id];
                      const isCurrentlyRunning = runningScenarioId === scenario.id;
                      return (
                        <div 
                          key={scenario.id} 
                          className={`flex items-center justify-between rounded p-2 transition-all ${
                            isCurrentlyRunning 
                              ? 'bg-blue-800 ring-2 ring-blue-400 animate-pulse' 
                              : 'bg-gray-800'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="text-xs font-medium">{scenario.name}</div>
                            <div className="text-xs text-gray-400">{scenario.description}</div>
                            {result && (
                              <div className="text-xs mt-1">
                                <span className={`${
                                  result.status === 'pass' ? 'text-green-400' : 
                                  result.status === 'partial' ? 'text-yellow-400' : 
                                  'text-red-400'
                                }`}>
                                  {result.status === 'pass' ? '✓' : 
                                   result.status === 'partial' ? '⚠' : '✗'} 
                                  {' '}{result.duration}ms
                                </span>
                                {result.status !== 'pass' && (
                                  <div className="text-xs text-red-300 mt-1">
                                    {result.actions.filter(a => a.status === 'fail')
                                      .map(a => a.message).join(', ')}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => runTestScenario(scenario)}
                            disabled={isRunning}
                            className="ml-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-xs transition-colors"
                          >
                            {isCurrentlyRunning ? (
                              <div className="flex items-center">
                                <div className="animate-spin mr-1 h-2 w-2 border-2 border-white border-t-transparent rounded-full"></div>
                                Running
                              </div>
                            ) : (
                              'Run'
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Export Results */}
            {Object.keys(testResults).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <button
                  onClick={() => {
                    const report = generateTestReport();
                    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `test-report-${new Date().toISOString()}.json`;
                    a.click();
                  }}
                  className="w-full px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
                >
                  Export Test Report
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}