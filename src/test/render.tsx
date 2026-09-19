import { render } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

export function renderUi(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}
