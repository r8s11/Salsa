// The calendar always renders dark (`isDark: true` in Calendar.tsx), so each
// type carries only Schedule-X's dark colour set.
export const CALENDARS_CONFIG = {
  social: {
    colorName: "social",
    darkColors: { main: "#ff5874", container: "#7a0a26", onContainer: "#ffd9df" },
  },
  class: {
    colorName: "class",
    darkColors: { main: "#7c93e9", container: "#2a3566", onContainer: "#dfe3ff" },
  },
  workshop: {
    colorName: "workshop",
    darkColors: { main: "#e9c349", container: "#574500", onContainer: "#fff0c2" },
  },
  live_music: {
    colorName: "live_music",
    darkColors: { main: "#ffb690", container: "#783200", onContainer: "#ffdbca" },
  },
};
