export interface PresetPrompt {
  label: string;
  prompt: string;
}

const DEFAULT_PRESETS: PresetPrompt[] = [
  { label: "Today", prompt: "What did I work on today?" },
  { label: "Flow", prompt: "Show me my recent flow sessions and where I broke focus." },
  { label: "This Week", prompt: "Give me a summary of this week so far." },
  { label: "Projects", prompt: "Which project has taken the most time recently?" },
];

const REPORTS_PRESETS: PresetPrompt[] = [
  { label: "This Week", prompt: "Give me a summary of this week so far." },
  { label: "Projects", prompt: "Break down this week by project and call out the top one." },
  { label: "Trend", prompt: "What trend stands out in my recent summaries?" },
  { label: "Focus", prompt: "How has my focus changed across recent days?" },
];

const REVIEW_PRESETS: PresetPrompt[] = [
  { label: "Review", prompt: "What should I look at first in review?" },
  { label: "Today", prompt: "What did I work on today?" },
  { label: "Projects", prompt: "Which project has the most unclear time right now?" },
  { label: "Flow", prompt: "Did interruptions hurt my flow today?" },
];

export function getPresetPrompts(currentView: string): PresetPrompt[] {
  if (currentView === "reports") {
    return REPORTS_PRESETS;
  }

  if (currentView === "review") {
    return REVIEW_PRESETS;
  }

  return DEFAULT_PRESETS;
}
