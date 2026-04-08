/**
 * Runs the onboarding step for a character.
 * Calls OnboardingService.completeOnboardingV2() directly.
 */

import { OnboardingService } from '../../services/OnboardingService.js';
import type { CharacterSheet } from './types.js';

export async function runOnboarding(userId: string, character: CharacterSheet): Promise<number> {
  const start = Date.now();

  console.log(`  [onboarding] Running V2 onboarding for ${character.name}...`);

  await OnboardingService.completeOnboardingV2(userId, {
    fullName: character.onboardingData.fullName,
    preferredName: character.onboardingData.preferredName,
    birthday: character.onboardingData.birthday,
    selectedCalendars: [...character.onboardingData.selectedCalendars],
    otherCalendar: character.onboardingData.otherCalendar,
    occupation: character.onboardingData.occupation,
    fieldOfStudy: character.onboardingData.fieldOfStudy,
    aspects: [...character.onboardingData.aspects],
    goals: [...character.onboardingData.goals],
    timezone: character.onboardingData.timezone,
  });

  const durationMs = Date.now() - start;
  console.log(`  [onboarding] Complete (${durationMs}ms) -- aspects: ${character.onboardingData.aspects.length}, goals: ${character.onboardingData.goals.length}`);

  return durationMs;
}
