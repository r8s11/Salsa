import { useTheme } from "../../../../contexts/useTheme";

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

/**
 * Theme radio group shared by the topbar account menu and the drawer's
 * account block. `name` keeps the two groups independent in the DOM.
 */
export default function AdminThemeOptions({ name }: { name: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset className="admin-account__theme-options">
      <legend className="admin-visually-hidden">Choose theme appearance</legend>
      {THEME_OPTIONS.map(({ value, label }) => (
        <label key={value} className="admin-account__theme-option">
          <input
            type="radio"
            name={name}
            value={value}
            checked={theme === value}
            onChange={() => setTheme(value)}
            aria-label={label}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
