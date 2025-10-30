// Helpers to neutralise onboarding/test-data modals during Vitest runs
// Ensure test suites see the dashboard without onboarding overlays
export const TEST_PREFERENCES_KEY = 'wt_test_preferences_flag';

export function markOnboardingComplete() {
  try {
    localStorage.setItem('onboardingCompleted', 'true');
    sessionStorage.setItem('onboardingCompleted', 'true');
  } catch (error) {
    console.warn('[testPreferences] Failed to mark onboarding as complete', error);
  }
}

export function dismissTestDataWarning() {
  try {
    localStorage.setItem('testDataWarningDismissed', 'true');
  } catch (error) {
    console.warn('[testPreferences] Failed to dismiss test data warning', error);
  }
}

export function resetOnboardingFlags() {
  try {
    localStorage.removeItem('onboardingCompleted');
    localStorage.removeItem('testDataWarningDismissed');
    sessionStorage.removeItem('onboardingCompleted');
  } catch (error) {
    console.warn('[testPreferences] Failed to reset onboarding flags', error);
  }
}
