import { createContext, useContext } from 'react';

type OnboardingContextValue = {
  markEntryCompleteInSession: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue>({
  markEntryCompleteInSession: () => {},
});

export const OnboardingProvider = OnboardingContext.Provider;

export function useOnboardingSession() {
  return useContext(OnboardingContext);
}
