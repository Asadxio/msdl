import React, { createContext, useContext, useState } from 'react';

export type TutorialScreen = 'dashboard' | 'courses' | 'live_classes' | 'notifications' | 'applications';

type TutorialContextType = {
  showTutorial: boolean;
  setShowTutorial: (v: boolean) => void;
  currentStep: TutorialScreen | null;
  setCurrentStep: (s: TutorialScreen | null) => void;
  completedSteps: Set<TutorialScreen>;
  markStepComplete: (s: TutorialScreen) => void;
};

const TutorialContext = createContext<TutorialContextType | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentStep, setCurrentStep] = useState<TutorialScreen | null>(null);
  const [completedSteps, setCompletedSteps] = useState(new Set<TutorialScreen>());

  const markStepComplete = (s: TutorialScreen) => {
    setCompletedSteps((prev) => new Set([...prev, s]));
  };

  return (
    <TutorialContext.Provider value={{ showTutorial, setShowTutorial, currentStep, setCurrentStep, completedSteps, markStepComplete }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
}
