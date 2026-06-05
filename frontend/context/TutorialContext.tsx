import React, { createContext, useContext, useEffect, useState } from 'react';

export type TutorialScreen = 'dashboard' | 'courses' | 'live_classes' | 'notifications' | 'applications';

type TutorialContextType = {
  showTutorial: boolean;
  setShowTutorial: (v: boolean) => void;
  currentStep: TutorialScreen | null;
  setCurrentStep: (s: TutorialScreen | null) => void;
  completedSteps: Set<TutorialScreen>;
  markStepComplete: (s: TutorialScreen) => void;
};

type TutorialProviderProps = {
  children: React.ReactNode;
  autoShowOnMount?: boolean;
  initialStep?: TutorialScreen;
};

const TutorialContext = createContext<TutorialContextType | null>(null);

export function TutorialProvider({ children, autoShowOnMount = false, initialStep = 'dashboard' }: TutorialProviderProps) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentStep, setCurrentStep] = useState<TutorialScreen | null>(null);
  const [completedSteps, setCompletedSteps] = useState(new Set<TutorialScreen>());
  const [tutorialAutoShown, setTutorialAutoShown] = useState(false);

  useEffect(() => {
    if (!tutorialAutoShown && autoShowOnMount) {
      setCurrentStep(initialStep);
      setShowTutorial(true);
      setTutorialAutoShown(true);
    }
  }, [autoShowOnMount, initialStep, tutorialAutoShown]);

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
