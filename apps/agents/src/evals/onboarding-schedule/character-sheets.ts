/**
 * Character sheets for onboarding-to-schedule eval.
 * Each persona represents a distinct user archetype with specific
 * life patterns that the enrichment chat should discover,
 * plus conversation scenarios that test post-enrichment agent behavior.
 */

import type { CharacterSheet, ConversationScenario } from './types.js';

/**
 * Shared conversation scenarios that apply to all characters.
 * Character-specific details are templated with {name} and {detail} placeholders.
 */
function buildScenarios(character: {
  name: string;
  occupation: string;
  timezone: string;
}): ConversationScenario[] {
  return [
    // Schedule queries
    {
      id: 'query-today',
      category: 'schedule-query',
      userMessage: 'what do i have today',
      description: 'Basic schedule query - should list events, not create anything',
      expectedBehavior: {
        shouldCallTools: ['list_events'],
        shouldNotCallTools: ['create_event', 'create_task', 'create_recurring_event'],
        responseShould: ['mention specific events or say calendar is empty'],
        responseShouldNot: ['use markdown headers', 'offer to create events unprompted'],
      },
    },
    {
      id: 'query-tomorrow',
      category: 'schedule-query',
      userMessage: 'what about tomorrow',
      description: 'Follow-up schedule query with relative time reference',
      expectedBehavior: {
        shouldCallTools: ['list_events'],
        shouldNotCallTools: ['create_event'],
        responseShould: ['reference tomorrows date or events'],
      },
    },
    {
      id: 'query-free-time',
      category: 'context-awareness',
      userMessage: 'do i have any free time tomorrow afternoon',
      description: 'Free time query - should check calendar and respond with specific windows',
      expectedBehavior: {
        shouldCallTools: ['find_free_time'],
        shouldNotCallTools: ['create_event'],
        responseShould: ['mention specific available time windows'],
      },
    },

    // Event creation
    {
      id: 'create-simple-event',
      category: 'event-create',
      userMessage: 'add a dentist appointment friday at 2pm for an hour',
      description: 'Simple one-time event creation',
      expectedBehavior: {
        shouldCallTools: ['create_event'],
        shouldNotCallTools: ['create_recurring_event', 'create_task'],
        responseShould: ['confirm the event was created'],
      },
    },
    {
      id: 'create-with-aspect',
      category: 'event-create',
      userMessage: 'i have a coffee chat with a colleague next wednesday at 11am',
      description: 'Event creation that should use an existing aspect',
      expectedBehavior: {
        shouldCallTools: ['create_event'],
        shouldNotCallTools: ['create_recurring_event'],
        responseShould: ['confirm creation'],
      },
    },

    // Event modification
    {
      id: 'modify-event',
      category: 'event-modify',
      userMessage: 'can you move my dentist appointment to 3pm instead',
      description: 'Event modification - should search then update, not create new',
      expectedBehavior: {
        shouldCallTools: ['search_events'],
        shouldNotCallTools: ['create_event'],
        responseShould: ['confirm the event was moved or updated'],
      },
    },

    // Task management
    {
      id: 'create-task',
      category: 'task-management',
      userMessage: 'remind me to buy a birthday gift for my mom',
      description: 'Task creation for non-time-bound item - should use create_task not create_event',
      expectedBehavior: {
        shouldCallTools: ['create_task'],
        shouldNotCallTools: ['create_event', 'create_recurring_event'],
        responseShould: ['confirm the task was created'],
      },
    },

    // Goal check-in
    {
      id: 'goal-checkin',
      category: 'goal-checkin',
      userMessage: 'how am i doing on my goals',
      description: 'Goal progress query - should list goals, not create new ones',
      expectedBehavior: {
        shouldCallTools: ['list_goals'],
        shouldNotCallTools: ['create_goal', 'create_event'],
        responseShould: ['mention the users existing goals'],
      },
    },

    // Duplicate avoidance
    {
      id: 'duplicate-check',
      category: 'duplicate-avoidance',
      userMessage: 'add a gym session for tomorrow morning at 7am',
      description: 'Should check if a gym event already exists at that time before creating',
      expectedBehavior: {
        shouldCallTools: ['list_events'],
        responseShould: ['either create it or note a conflict exists'],
        responseShouldNot: ['create without checking for conflicts'],
      },
    },

    // Edge case
    {
      id: 'ambiguous-request',
      category: 'edge-case',
      userMessage: 'i need to study more',
      description: 'Vague request - should ask for details or create a suggestion, not a scheduled event',
      expectedBehavior: {
        shouldCallTools: [],
        shouldNotCallTools: ['create_event', 'create_recurring_event'],
        responseShould: ['ask for more details about when or what to study'],
      },
    },

    // Suggestion interaction
    {
      id: 'suggestion-query',
      category: 'suggestion-interact',
      userMessage: 'what should i work on next',
      description: 'Should check suggestions or schedule to recommend next activity',
      expectedBehavior: {
        shouldCallTools: ['list_action_suggestions'],
        shouldNotCallTools: ['create_event'],
        responseShould: ['suggest a specific activity based on goals or backlog'],
      },
    },
  ];
}

export const CHARACTERS: readonly CharacterSheet[] = [
  {
    id: 'busy-student',
    name: 'Marcus Chen',
    onboardingData: {
      fullName: 'Marcus Chen',
      preferredName: 'Marcus',
      birthday: '2004-03-15',
      selectedCalendars: [],
      occupation: 'Student',
      fieldOfStudy: 'Computer Science',
      aspects: ['School', 'Work', 'Health', 'Social'],
      goals: [
        'Get a 3.8 GPA this semester',
        'Run a half marathon in October',
        'Save $2000 by summer',
      ],
      timezone: 'America/Los_Angeles',
    },
    personality: `You are Marcus Chen, a 22-year-old CS junior at Stanford. You are friendly but concise -- you answer questions directly without over-explaining. You sometimes use casual language like "yeah" and "nah". You volunteer schedule details when asked but don't dump everything at once. You're a bit stressed about balancing school and work but generally upbeat.`,
    enrichmentDetails: [
      'I take CS 161 (Algorithms) MWF 10:30am-11:20am in Gates B01 with Professor Roughgarden',
      'I take CS 221 (AI) TTh 1:30pm-2:50pm in Hewlett 200 with Professor Liang',
      'I take MATH 120 (Groups and Rings) MWF 1:30pm-2:20pm in room 380-380C',
      'I work at Blue Bottle Coffee on campus, Tuesday and Thursday mornings 6am-10am, and Saturday 7am-1pm',
      'I go to the gym (lifting) Monday, Wednesday, Friday around 7:30am before class. Usually takes about an hour',
      'I run on Tuesday and Thursday evenings around 6pm, training for a half marathon',
      'I have a study group for CS 161 on Sunday afternoons from 2-5pm at Green Library',
      'I try to do problem sets on weekday evenings, usually 7-10pm',
      'I wake up around 6:30am on weekdays and go to bed around midnight',
      'I play pickup basketball with friends on Saturday afternoons',
    ],
    conversationScenarios: buildScenarios({ name: 'Marcus', occupation: 'Student', timezone: 'America/Los_Angeles' }),
    expectedOutcomes: {
      minAspects: 4,
      minRecurringEvents: 6,
      minGoals: 3,
      expectedAspectNames: ['CS 161', 'CS 221', 'MATH 120', 'Blue Bottle', 'Health', 'Social'],
      expectedSchedulePatterns: [
        'MWF morning classes',
        'TTh afternoon class',
        'TTh morning work shifts',
        'Saturday work shift',
        'MWF gym sessions',
        'TTh evening runs',
        'Sunday study group',
      ],
    },
  },

  {
    id: 'working-parent',
    name: 'Sarah Johnson',
    onboardingData: {
      fullName: 'Sarah Johnson',
      preferredName: 'Sarah',
      birthday: '1988-07-22',
      selectedCalendars: [],
      occupation: 'Product Manager',
      aspects: ['Work', 'Family', 'Health', 'Personal'],
      goals: [
        'Get promoted to Senior PM by Q4',
        'Run 3x per week consistently',
        'Read 2 books per month',
      ],
      timezone: 'America/New_York',
    },
    personality: `You are Sarah Johnson, a 37-year-old product manager at a mid-size SaaS company. You have two kids (ages 5 and 8). You are organized and efficient in conversation -- you give clear, structured answers. You're used to managing a lot and you talk about your schedule in terms of blocks and routines. You sometimes mention your husband Tom who handles mornings while you handle evenings.`,
    enrichmentDetails: [
      'I work 9am to 5:30pm Monday through Friday. My office is in Midtown Manhattan but I work from home on Tuesdays and Thursdays',
      'I have a daily standup at 9:30am every weekday, 15 minutes',
      'I have a team sprint planning meeting every Monday from 2-3pm',
      'I have 1:1 with my manager every Wednesday 11am-11:30am',
      'I do school pickup for the kids at 3:15pm on Monday, Wednesday, Friday. My husband Tom handles Tuesday and Thursday',
      'After pickup I do homework help and dinner prep from about 3:30-6pm on my pickup days',
      'I run Tuesday and Thursday mornings at 6am for about 45 minutes, and Saturday mornings at 7am for a longer run',
      'Kids have soccer practice Wednesday 4-5pm and Saturday 9-10am',
      'Date night with Tom is every other Friday, usually 7-10pm',
      'I read for about 30 minutes before bed most nights, around 9:30pm',
      'Sunday mornings I do meal prep for the week, about 2 hours starting at 8am',
    ],
    conversationScenarios: buildScenarios({ name: 'Sarah', occupation: 'Product Manager', timezone: 'America/New_York' }),
    expectedOutcomes: {
      minAspects: 4,
      minRecurringEvents: 7,
      minGoals: 3,
      expectedAspectNames: ['Work', 'Family', 'Health', 'Personal'],
      expectedSchedulePatterns: [
        'Weekday work hours 9-5:30',
        'Daily standup',
        'Monday sprint planning',
        'Wednesday 1:1',
        'MWF school pickup',
        'TTh and Sat morning runs',
        'Sunday meal prep',
      ],
    },
  },

  {
    id: 'freelance-creative',
    name: 'Alex Rivera',
    onboardingData: {
      fullName: 'Alex Rivera',
      preferredName: 'Alex',
      birthday: '1995-11-03',
      selectedCalendars: [],
      occupation: 'Freelance Designer',
      aspects: ['Design Work', 'Health', 'Side Projects', 'Social'],
      goals: [
        'Land 2 new retainer clients this quarter',
        'Launch my font on Creative Market',
        'Establish a consistent morning routine',
      ],
      timezone: 'America/Denver',
    },
    personality: `You are Alex Rivera, a 30-year-old freelance UI/UX designer based in Denver. You are creative and a bit scattered -- your schedule varies week to week depending on client deadlines. You're enthusiastic about your work and talk about projects with energy. You tend to give longer answers and go on tangents about your creative process. You're working on being more structured, which is why you signed up for Glyde.`,
    enrichmentDetails: [
      'I usually start my day around 8:30am with yoga -- I do a 30 minute flow at home most mornings',
      'I have a standing call with my main client Hatch Studio every Monday and Thursday at 10am, usually 45 minutes',
      'I have a biweekly portfolio review with my design collective every other Wednesday at 2pm, about an hour',
      'I try to do focused design work in the mornings from about 9:30am to 12:30pm on days without client calls',
      'Tuesdays I go to a coworking space all day, roughly 9am to 5pm',
      'I take a pottery class on Wednesday evenings, 6-8pm at the Denver Art Students League',
      'I go climbing at the gym on Monday, Wednesday, and Friday evenings around 5:30pm for about 90 minutes',
      'Weekends are flexible but I try to spend Saturday mornings on my font side project from about 9am to noon',
      'I cook dinner most nights around 7pm',
      'Friday evenings are usually social -- drinks or dinner with friends',
    ],
    conversationScenarios: buildScenarios({ name: 'Alex', occupation: 'Freelance Designer', timezone: 'America/Denver' }),
    expectedOutcomes: {
      minAspects: 4,
      minRecurringEvents: 5,
      minGoals: 3,
      expectedAspectNames: ['Design Work', 'Hatch Studio', 'Health', 'Side Projects', 'Social'],
      expectedSchedulePatterns: [
        'Morning yoga routine',
        'Monday and Thursday client calls',
        'Tuesday coworking day',
        'MWF climbing sessions',
        'Wednesday pottery class',
        'Saturday morning font work',
      ],
    },
  },

  {
    id: 'grad-researcher',
    name: 'Priya Patel',
    onboardingData: {
      fullName: 'Priya Patel',
      preferredName: 'Priya',
      birthday: '1997-01-28',
      selectedCalendars: [],
      occupation: 'PhD Candidate',
      fieldOfStudy: 'Computational Biology',
      aspects: ['Research', 'Teaching', 'Health', 'Personal'],
      goals: [
        'Submit thesis chapter 3 draft by May 15',
        'Publish paper in Nature Computational Science',
        'Meditate daily for 20 minutes',
      ],
      timezone: 'America/Chicago',
    },
    personality: `You are Priya Patel, a 29-year-old PhD candidate in computational biology at UChicago. You are articulate and precise -- you describe your schedule in detail because you've carefully planned it. You're in your 4th year and feeling the pressure to publish and finish. You are calm and thoughtful in conversation. You mention your advisor Dr. Kim occasionally.`,
    enrichmentDetails: [
      'I TA for BIOS 20187 on Tuesdays and Thursdays. I hold a discussion section from 10-11am and office hours from 11am-12pm',
      'I have lab meeting with Dr. Kim and the rest of the lab every Wednesday from 2-3:30pm in Erman Bio Center',
      'I have a 1:1 with my advisor Dr. Kim every Friday at 10am, usually 30-45 minutes',
      'I do my computational work and thesis writing most mornings from 8:30am to noon in my office',
      'I run experiments in the wet lab Tuesday and Thursday afternoons from 1-4pm',
      'I meditate every morning at 7am for 20 minutes using the Waking Up app',
      'I go to a yoga class on Monday and Friday evenings at 5:30pm at CorePower, about an hour',
      'I have a writing accountability group on Mondays from 9am to noon where we do focused thesis writing together',
      'I usually have dinner with my partner around 6:30pm',
      'Saturdays I try to take fully off. Sundays I do about 3-4 hours of reading papers from 10am to 2pm',
    ],
    conversationScenarios: buildScenarios({ name: 'Priya', occupation: 'PhD Candidate', timezone: 'America/Chicago' }),
    expectedOutcomes: {
      minAspects: 4,
      minRecurringEvents: 7,
      minGoals: 3,
      expectedAspectNames: ['Research', 'Teaching', 'BIOS 20187', 'Health', 'Personal'],
      expectedSchedulePatterns: [
        'TTh TA discussion + office hours',
        'Wednesday lab meeting',
        'Friday advisor 1:1',
        'Weekday morning thesis writing',
        'TTh afternoon lab work',
        'Daily morning meditation',
        'MF evening yoga',
        'Monday writing group',
        'Sunday paper reading',
      ],
    },
  },

  {
    id: 'career-changer',
    name: 'James Wright',
    onboardingData: {
      fullName: 'James Wright',
      preferredName: 'James',
      birthday: '1991-09-10',
      selectedCalendars: [],
      occupation: 'Accountant',
      aspects: ['Day Job', 'Bar Exam Prep', 'Health', 'Personal'],
      goals: [
        'Pass the bar exam in July',
        'Maintain mental health while studying',
        'Complete Barbri course on schedule',
      ],
      timezone: 'America/New_York',
    },
    personality: `You are James Wright, a 34-year-old accountant who went to law school part-time and is now studying for the bar exam while still working full-time. You are determined but clearly stretched thin. You talk about your schedule matter-of-factly, acknowledging the grind. You're disciplined and have a very structured evening/weekend study routine. You appreciate anything that helps you stay on track.`,
    enrichmentDetails: [
      'I work at PwC as a senior accountant, Monday through Friday 8:30am to 5pm. My office is downtown',
      'I have a team meeting every Monday at 9am for 30 minutes',
      'I have a client check-in call every Wednesday at 2pm, about 45 minutes',
      'After work I study for the bar Monday through Friday from 6:30pm to 10pm at home',
      'I use Barbri -- I follow their daily schedule which assigns readings, lectures, and practice essays',
      'Saturdays I do a full study day from 8am to 4pm at the NYPL study rooms',
      'Sundays I study from 9am to 1pm, then take the rest of the day off',
      'I go to the gym Monday, Wednesday, Friday mornings at 6am for about 45 minutes before work',
      'I try to go for a 30 minute walk during my lunch break on days when it is not raining',
      'I call my parents every Sunday evening around 6pm for about an hour',
      'I see a therapist every other Thursday at 5:30pm for an hour',
    ],
    conversationScenarios: buildScenarios({ name: 'James', occupation: 'Accountant', timezone: 'America/New_York' }),
    expectedOutcomes: {
      minAspects: 4,
      minRecurringEvents: 6,
      minGoals: 3,
      expectedAspectNames: ['PwC', 'Day Job', 'Bar Exam Prep', 'Barbri', 'Health', 'Personal'],
      expectedSchedulePatterns: [
        'Weekday work hours 8:30-5',
        'Monday team meeting',
        'Wednesday client call',
        'Weekday evening study 6:30-10',
        'Saturday full study day',
        'Sunday morning study',
        'MWF morning gym',
        'Biweekly therapy',
      ],
    },
  },
];

export function getCharacterById(id: string): CharacterSheet | undefined {
  return CHARACTERS.find(c => c.id === id);
}

export function getCharacterIds(): readonly string[] {
  return CHARACTERS.map(c => c.id);
}
