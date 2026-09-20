import { toast } from "sonner";
import { copyToClipboard } from "./copy-to-clipboard";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  vi.restoreAllMocks();
});

it("writes to the clipboard and reports success only when a message is given", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

  await copyToClipboard("hello");
  expect(writeText).toHaveBeenCalledWith("hello");
  expect(toast.success).not.toHaveBeenCalled();

  await copyToClipboard("/api/shop", "Base URL copied");
  expect(toast.success).toHaveBeenCalledWith("Base URL copied");
});

it("falls back to an error toast when the clipboard write is denied or unavailable", async () => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    configurable: true,
  });
  await copyToClipboard("hello");
  expect(toast.error).toHaveBeenCalledWith("Could not copy to the clipboard.");
});
