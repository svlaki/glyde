const fetch = require('node-fetch');

// Get the access token from your current session (you'll need to provide this)
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN_HERE';
const USER_ID = 'ad32cecc-b52f-4afa-9360-3ead4a3bda85';
const API_URL = 'http://localhost:8000';

async function createEvent(title, date, startTime, endTime, description = '') {
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + date); // Add days from today
  const dateStr = eventDate.toISOString().split('T')[0];
  
  const response = await fetch(`${API_URL}/api/agent/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      context: {
        userId: USER_ID,
        sessionId: 'test-events-creation'
      },
      message: `Create an event called "${title}" on ${dateStr} at ${startTime} for ${endTime - startTime} hour${endTime - startTime > 1 ? 's' : ''}. ${description ? `Description: ${description}` : ''}`
    })
  });
  
  const result = await response.json();
  console.log(`Creating "${title}":`, result.response?.content || result.response || 'No response');
  return result;
}

async function createSampleWeek() {
  console.log('Creating sample week of events...\n');
  
  // Monday
  await createEvent('Morning Standup', 1, '9:00', '9:30', 'Daily team sync');
  await createEvent('Deep Work Session', 1, '10:00', '12:00', 'Focus on project development');
  await createEvent('Lunch Break', 1, '12:00', '13:00');
  await createEvent('Client Meeting', 1, '14:00', '15:00', 'Quarterly review');
  await createEvent('Email Review', 1, '16:00', '16:30');
  
  // Tuesday  
  await createEvent('Gym Session', 2, '7:00', '8:00', 'Cardio and weights');
  await createEvent('Team Brainstorming', 2, '10:00', '11:30', 'New feature planning');
  await createEvent('Lunch with Sarah', 2, '12:30', '13:30');
  await createEvent('Code Review', 2, '14:00', '15:00');
  await createEvent('Personal Study Time', 2, '19:00', '20:00', 'Learning React patterns');
  
  // Wednesday
  await createEvent('Morning Yoga', 3, '6:30', '7:30');
  await createEvent('Project Planning', 3, '9:00', '10:00');
  await createEvent('Team Meeting', 3, '10:30', '11:30');
  await createEvent('Dentist Appointment', 3, '15:00', '16:00');
  await createEvent('Dinner with Family', 3, '18:30', '20:00');
  
  // Thursday
  await createEvent('Morning Run', 4, '6:00', '7:00');
  await createEvent('Sprint Review', 4, '9:00', '10:00');
  await createEvent('1-on-1 with Manager', 4, '11:00', '11:30');
  await createEvent('Lunch & Learn Session', 4, '12:00', '13:00', 'AI in development');
  await createEvent('Focus Time', 4, '14:00', '17:00', 'No meetings block');
  
  // Friday
  await createEvent('Weekly Review', 5, '9:00', '10:00', 'Review goals and progress');
  await createEvent('Team Retro', 5, '10:30', '11:30');
  await createEvent('Lunch with Team', 5, '12:00', '13:30', 'Team building');
  await createEvent('Planning for Next Week', 5, '15:00', '16:00');
  await createEvent('Happy Hour', 5, '17:00', '19:00', 'Team social');
  
  // Weekend
  await createEvent('Grocery Shopping', 6, '10:00', '11:00');
  await createEvent('Hiking', 6, '14:00', '17:00', 'Trail at local park');
  await createEvent('Movie Night', 6, '20:00', '22:00');
  
  await createEvent('Brunch with Friends', 7, '11:00', '13:00');
  await createEvent('Meal Prep', 7, '15:00', '16:30', 'Prepare meals for the week');
  await createEvent('Reading Time', 7, '19:00', '20:00', 'Personal development book');
  
  console.log('\n✅ Sample week created successfully!');
}

// Note: You need to get your access token from the browser
console.log(`
⚠️  IMPORTANT: You need to provide your access token!

1. Open your browser's developer tools (F12)
2. Go to the Network tab
3. Make any request in the app
4. Find a request and copy the Authorization header value (after "Bearer ")
5. Run this script with: ACCESS_TOKEN="your_token_here" node create-sample-events.js
`);

if (ACCESS_TOKEN && ACCESS_TOKEN !== 'YOUR_ACCESS_TOKEN_HERE') {
  createSampleWeek().catch(console.error);
} else {
  console.log('Please provide your access token to continue.');
}