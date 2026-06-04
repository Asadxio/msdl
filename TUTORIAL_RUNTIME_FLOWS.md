# Runtime Integration Flow Diagrams

## 1. Fresh Install Flow (First-Time User)

```mermaid
graph TD
    Start["App Starts"] --> OnboardEntry{"shouldShowOnboardingEntry<br/>checks first install"}
    OnboardEntry -->|First Install| Onboarding["📺 Onboarding Screen<br/>6-slide carousel"]
    OnboardEntry -->|User Exists| SkipOnboarding["Skip to Login/Dashboard"]
    
    Onboarding --> OnboardDone{"User Completes<br/>Onboarding?"}
    OnboardDone -->|Yes| OnboardSave["💾 Save AsyncStorage<br/>onboarding_completed<br/>::{version}"]
    OnboardSave --> Login["🔐 Route to Login"]
    
    Login --> AuthSuccess["✅ Auth Success<br/>Route to Dashboard"]
    SkipOnboarding --> AuthSuccess
    
    AuthSuccess --> DashboardLoad["📊 Dashboard Renders"]
    DashboardLoad --> DashboardEffect["useEffect fires<br/>800ms delay"]
    
    DashboardEffect --> CheckTutorial{"isTutorialCompleted?<br/>Check AsyncStorage"}
    CheckTutorial -->|Not Completed| TutorialStart["🎬 Tutorial Starts<br/>Step 1: Dashboard"]
    CheckTutorial -->|Already Completed| SkipTutorial["Skip Tutorial<br/>Show Dashboard"]
    
    TutorialStart --> TutorialOverlay["🎯 InAppTutorialOverlay<br/>Shows with Backdrop"]
    TutorialOverlay --> TutorialSteps["Step 1 → 2 → 3 → 4 → 5"]
    
    TutorialSteps --> UserAction{"User Action?"}
    UserAction -->|Skip| SkipAction["Skip Pressed at Step N"]
    UserAction -->|Done| DoneAction["Done Pressed at Step 5"]
    
    SkipAction --> CompleteMark1["markTutorialCompleted()"]
    DoneAction --> CompleteMark2["markTutorialCompleted()"]
    
    CompleteMark1 --> StorageSave1["💾 Save AsyncStorage<br/>tutorial_..._completed<br/>::{version}"]
    CompleteMark2 --> StorageSave2["💾 Save AsyncStorage<br/>tutorial_..._completed<br/>::{version}"]
    
    StorageSave1 --> HideTutorial1["setShowTutorial false"]
    StorageSave2 --> HideTutorial2["setShowTutorial false"]
    
    HideTutorial1 --> FinalDash1["✅ Tutorial Complete<br/>Dashboard Visible"]
    HideTutorial2 --> FinalDash2["✅ Tutorial Complete<br/>Dashboard Visible"]
    
    SkipTutorial --> FinalDash3["✅ Dashboard Ready"]
    FinalDash1 --> End["🎉 Ready to Use App"]
    FinalDash2 --> End
    FinalDash3 --> End
```

## 2. Returning User Flow (Same Version)

```mermaid
graph TD
    Start["User Logs In"] --> Dashboard["📊 Dashboard Loads"]
    Dashboard --> Effect["useEffect Fires<br/>tutorialStartedRef check"]
    
    Effect --> CheckAuth{"profile?.uid<br/>exists?"}
    CheckAuth -->|No| Wait["⏳ Wait for Auth"]
    Wait --> CheckAuth
    
    CheckAuth -->|Yes| CheckRef{"tutorialStartedRef<br/>already set?"}
    CheckRef -->|Yes| Skip1["Skip Tutorial Check<br/>Already Triggered"]
    CheckRef -->|No| CheckStorage["Check AsyncStorage<br/>tutorial_..._completed<br/>::{version}"]
    
    CheckStorage --> StorageCheck{"Key Exists<br/>and true?"}
    StorageCheck -->|Yes| Skip2["✅ Tutorial Already Done<br/>Skip Overlay"]
    StorageCheck -->|No| Trigger["🎬 Trigger Tutorial"]
    
    Skip1 --> NormalDash["📊 Show Dashboard"]
    Skip2 --> NormalDash
    
    Trigger --> SetRef["Set tutorialStartedRef = true"]
    SetRef --> ShowOverlay["Show InAppTutorialOverlay"]
    ShowOverlay --> TutorialFlow["5-Step Tutorial"]
    
    NormalDash --> End["✅ User Sees Dashboard"]
    TutorialFlow --> Complete["Tutorial Completion"]
    Complete --> End
```

## 3. Version Update Flow

```mermaid
graph TD
    OldVersion["App Version 1.0.0<br/>Tutorial Completed"]
    
    OldVersion --> Update["🔄 App Updates<br/>to Version 1.1.0"]
    Update --> AppStart["App Starts"]
    
    AppStart --> Dashboard["📊 Dashboard Loads"]
    Dashboard --> CheckVersion["Check AsyncStorage<br/>tutorial_..._completed<br/>::{version}"]
    
    CheckVersion --> OldKey["❌ Key for 1.0.0 Found<br/>but checking 1.1.0"]
    OldKey --> NewKey{"Key for 1.1.0<br/>exists?"}
    
    NewKey -->|No| Trigger["🎬 Tutorial Triggers<br/>for New Version"]
    NewKey -->|Yes| Skip["Skip Tutorial<br/>Already Done in 1.1.0"]
    
    Trigger --> NewTutorial["📺 Show Full 5-Step<br/>Tutorial Again"]
    NewTutorial --> UserCompletes["User Completes/Skips"]
    UserCompletes --> SaveNew["💾 Save New Key<br/>tutorial_..._completed<br/>::1.1.0"]
    
    SaveNew --> NextUpdate["Next Version Update<br/>Resets Again"]
    NextUpdate --> End["🎉 Cycle Repeats"]
    
    Skip --> Dashboard2["📊 Dashboard Ready"]
    Dashboard2 --> End
```

## 4. Duplicate Prevention Mechanism

```mermaid
graph TD
    Session1["Session Start"] --> Ref["tutorialStartedRef = false"]
    Ref --> Effect1["useEffect Fire 1"]
    
    Effect1 --> Check1{"tutorialStartedRef<br/>already true?"}
    Check1 -->|No| Async1["🔄 Async Storage Check"]
    Check1 -->|Yes| Skip1["⏭️ Skip Check"]
    
    Async1 --> SetRef["tutorialStartedRef = true"]
    SetRef --> Show1["Show Tutorial"]
    
    Skip1 --> Skip
    
    Show1 --> Interactive["User Interacts"]
    Interactive --> Effect2["useEffect Fire 2<br/>Component Re-render"]
    
    Effect2 --> Check2{"tutorialStartedRef<br/>already true?"}
    Check2 -->|Yes| Skip2["⏭️ Skip Check<br/>Already Triggered"]
    Check2 -->|No| Invalid["❌ Should Not Happen"]
    
    Skip2 --> Overlay["Show Overlay<br/>One Time Only"]
    
    Overlay --> Complete["User Completes<br/>markTutorialCompleted()"]
    Complete --> SessionEnd["Session Ends"]
    
    SessionEnd --> AppRestart["App Restarts<br/>New Session"]
    AppRestart --> Ref2["tutorialStartedRef = false<br/>New Ref Instance"]
    Ref2 --> Check3{"Tutorial<br/>Completed?"}
    Check3 -->|Yes| Skip3["⏭️ Skip Tutorial<br/>Already Completed"]
    Check3 -->|No| Show2["Show Tutorial"]
    
    Skip3 --> End["✅ No Duplicate"]
```

## 5. Complete User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                    FIRST-TIME USER JOURNEY                      │
└─────────────────────────────────────────────────────────────────┘

Day 1: Fresh Install
├─ [1] App Starts
│  └─ Onboarding Entry Check
│     └─ First Install → Show Onboarding (6 slides)
│        ├─ Slide 1: Welcome
│        ├─ Slide 2: Live Classes
│        ├─ Slide 3: Audio Lessons
│        ├─ Slide 4: Attendance & Quiz
│        ├─ Slide 5: Islamic Tools
│        └─ Slide 6: Get Started
│
├─ [2] User Completes Onboarding
│  └─ onboarding_completed::1.0.0 ← Saved
│     └─ Route to /auth/login
│
├─ [3] User Creates Account & Logs In
│  └─ Dashboard Loads
│     ├─ useEffect fires (800ms delay)
│     ├─ Checks: isTutorialCompleted()
│     └─ NOT FOUND → Trigger Tutorial
│        └─ Show InAppTutorialOverlay
│           ├─ Step 1: Dashboard
│           ├─ Step 2: Courses  
│           ├─ Step 3: Live Classes
│           ├─ Step 4: Notifications
│           └─ Step 5: More → Applications
│
├─ [4] User Presses "Done"
│  └─ markTutorialCompleted()
│     └─ tutorial_..._completed::1.0.0 ← Saved
│        └─ InAppTutorialOverlay Dismissed
│
└─ [5] Dashboard Ready
   └─ User can explore app fully

────────────────────────────────────────────────────────────────

Day 2: Returning User (Same Version)
├─ [1] User Logs Back In
│  └─ Dashboard Loads
│     ├─ useEffect fires
│     ├─ Checks: isTutorialCompleted()
│     └─ FOUND → Skip Tutorial
│        └─ Show Dashboard Directly
│
└─ [2] Normal Dashboard Experience
   └─ No Tutorial Overlay

────────────────────────────────────────────────────────────────

Week Later: App Update to v1.1.0
├─ [1] User Updates App
│  └─ Dashboard Loads
│     ├─ useEffect fires
│     ├─ Checks: isTutorialCompleted() for v1.1.0
│     └─ NOT FOUND (only old v1.0.0 key exists)
│        └─ Trigger Tutorial AGAIN
│           └─ Show Full 5-Step Tutorial
│
├─ [2] User Completes Tutorial
│  └─ tutorial_..._completed::1.1.0 ← Saved (New Key)
│     └─ InAppTutorialOverlay Dismissed
│
└─ [3] Dashboard Ready for v1.1.0
   └─ Tutorial won't show again until next version

────────────────────────────────────────────────────────────────

Storage Timeline:
┌──────────────────┬─────────────────────────────────┐
│ Event            │ AsyncStorage Keys               │
├──────────────────┼─────────────────────────────────┤
│ Fresh Install    │ (empty)                         │
│ Complete Onboard │ onboarding_completed::1.0.0     │
│ Complete Tutorial│ tutorial_...::1.0.0             │
│ Update to v1.1.0 │ onboarding_completed::1.0.0     │
│                  │ tutorial_...::1.0.0             │
│ Complete v1.1.0  │ tutorial_...::1.0.0             │
│ Tutorial         │ tutorial_...::1.1.0 ← New Key   │
└──────────────────┴─────────────────────────────────┘
```

## Key Points

✅ **One-Time Per Version**: Tutorial shows only once per app version  
✅ **Persistent Across Logout**: AsyncStorage key survives logout/login  
✅ **Version-Based Reset**: Updating app version resets tutorial for that version  
✅ **No Duplicate Triggers**: tutorialStartedRef prevents multiple checks in same session  
✅ **Smooth UX**: 800ms delay lets dashboard render before overlay shows  
✅ **Error Resilient**: AsyncStorage errors caught and ignored gracefully  
