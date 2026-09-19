export function Kicker({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`kicker ${className}`}>{children}</p>;
}
