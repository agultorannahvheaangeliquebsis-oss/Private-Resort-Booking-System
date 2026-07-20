// Fabian's Azzure Private Resort logo.
export function Brandmark({ className }: { className?: string }) {
  return (
    <img
      src="/logo.jpg"
      alt="Fabian's Azzure Private Resort"
      className={`rounded-full object-cover ${className ?? ""}`}
    />
  );
}
