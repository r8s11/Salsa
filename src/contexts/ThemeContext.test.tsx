import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ThemeProvider } from "./ThemeContext";
import { useTheme } from "./useTheme";

function TestConsumer() {
  const { theme, effectiveTheme, setTheme } = useTheme();
  return (
    <div>
      <p data-testid="theme">{theme}</p>
      <p data-testid="effective">{effectiveTheme}</p>
      <button onClick={() => setTheme("dark")}>dark</button>
      <button onClick={() => setTheme("light")}>light</button>
      <button onClick={() => setTheme("system")}>system</button>
    </div>
  );
}

function mockMatchMedia(prefersDark: boolean) {
  const listeners: ((event: MediaQueryListEvent) => void)[] = [];
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
    media: query,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.push(listener);
    },
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  return {
    fireChange: (matches: boolean) =>
      listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent)),
  };
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    const shell = document.querySelector(".admin-shell");
    shell?.removeAttribute("data-theme");
  });

  it("defaults to system when nothing is stored, resolving via matchMedia", () => {
    mockMatchMedia(true);
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(screen.getByTestId("effective")).toHaveTextContent("dark");
  });

  it("reads a previously persisted explicit theme from localStorage", () => {
    window.localStorage.setItem("admin-theme", "light");
    mockMatchMedia(true);
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(screen.getByTestId("effective")).toHaveTextContent("light");
  });

  it("ignores an invalid stored value and falls back to system", () => {
    window.localStorage.setItem("admin-theme", "not-a-real-theme");
    mockMatchMedia(false);
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
  });

  it("setTheme updates state, persists to localStorage, and updates effectiveTheme", () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByText("dark"));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("effective")).toHaveTextContent("dark");
    expect(window.localStorage.getItem("admin-theme")).toBe("dark");
  });

  it("live-updates effectiveTheme when the OS preference changes while theme is system", () => {
    const { fireChange } = mockMatchMedia(false);
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("effective")).toHaveTextContent("light");
    act(() => {
      fireChange(true);
    });
    expect(screen.getByTestId("effective")).toHaveTextContent("dark");
  });

  it("useTheme throws when used outside ThemeProvider", () => {
    const ConsumerOnly = () => {
      useTheme();
      return null;
    };
    // Suppress the expected React error-boundary console noise for this one assertion.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ConsumerOnly />)).toThrow("useTheme must be used inside <ThemeProvider>");
    spy.mockRestore();
  });
});
