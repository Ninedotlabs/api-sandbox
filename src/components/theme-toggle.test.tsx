import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

it("switches from dark to light", async () => {
  const user = userEvent.setup();
  render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <ThemeToggle />
    </ThemeProvider>,
  );
  await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
  await user.click(screen.getByRole("button", { name: "Toggle theme" }));
  await waitFor(() => expect(document.documentElement).toHaveClass("light"));
});
