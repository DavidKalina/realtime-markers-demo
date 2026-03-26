export interface AdventureOption {
  label: string;
  value: string;
  emoji: string;
}

export const ACTIVITY_OPTIONS: AdventureOption[] = [
  { label: "Food", value: "food", emoji: "🍽️" },
  { label: "Coffee", value: "coffee", emoji: "☕" },
  { label: "Music", value: "music", emoji: "🎵" },
  { label: "Art", value: "art", emoji: "🎨" },
  { label: "Outdoors", value: "outdoors", emoji: "🌳" },
  { label: "Boarding", value: "boarding", emoji: "🛹" },
  { label: "Hiking", value: "hiking", emoji: "🥾" },
  { label: "Walking", value: "walking", emoji: "🚶" },
  { label: "Nightlife", value: "nightlife", emoji: "🍸" },
  { label: "Brews", value: "brews", emoji: "🍺" },
  { label: "Thrifting", value: "thrifting", emoji: "🛍️" },
  { label: "Sports", value: "sports", emoji: "⚽" },
  { label: "Culture", value: "culture", emoji: "🏛️" },
];

export const INTENTION_OPTIONS: AdventureOption[] = [
  { label: "Recharge", value: "recharge", emoji: "🧘" },
  { label: "Explore", value: "explore", emoji: "🧭" },
  { label: "Socialize", value: "socialize", emoji: "🍻" },
  { label: "Move", value: "move", emoji: "🏃" },
  { label: "Learn", value: "learn", emoji: "📚" },
  { label: "Treat Yourself", value: "treat_yourself", emoji: "💎" },
  { label: "Lock In", value: "lock_in", emoji: "🔒" },
];

export const PACE_OPTIONS: AdventureOption[] = [
  { label: "Chill", value: "chill", emoji: "🧘" },
  { label: "Balanced", value: "balanced", emoji: "⚖️" },
  { label: "Send It", value: "send_it", emoji: "🚀" },
];

export const DURATION_OPTIONS: AdventureOption[] = [
  { label: "1-2 hours", value: "1.5", emoji: "⚡" },
  { label: "Half day", value: "4", emoji: "🌤️" },
  { label: "Full day", value: "8", emoji: "☀️" },
  { label: "All day+", value: "12", emoji: "🌅" },
];

export const TIME_OF_DAY_OPTIONS: AdventureOption[] = [
  { label: "Right now", value: "right_now", emoji: "🚀" },
  { label: "Morning", value: "morning", emoji: "🌅" },
  { label: "Afternoon", value: "afternoon", emoji: "☀️" },
  { label: "Evening", value: "evening", emoji: "🌙" },
];
