import { toast } from "sonner";

/**
 * Copies text to the clipboard. Reports success only when a message is given (some copies,
 * like a path or a cURL snippet, are silent on success); always falls back to a plain-language
 * error toast when the clipboard is unavailable or the browser denies access.
 */
export async function copyToClipboard(text: string, successMessage?: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    if (successMessage) toast.success(successMessage);
  } catch {
    toast.error("Could not copy to the clipboard.");
  }
}
