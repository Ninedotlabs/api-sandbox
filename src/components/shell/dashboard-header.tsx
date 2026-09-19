import { Logo } from "./logo";
import { UserAvatar } from "./user-avatar";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-8">
        <Logo />
        <div className="flex items-center gap-1">
          <UserAvatar />
        </div>
      </div>
    </header>
  );
}
