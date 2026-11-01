import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** "Белсенді / Архив" switch for the admin people lists (?view=archived). */
export function ArchiveTabs({ basePath, archived, activeCount }: { basePath: string; archived: boolean; activeCount?: number }) {
  const tab = (href: string, label: string, current: boolean) => (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-semibold transition",
        current ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Тізім сүзгісі">
      {tab(basePath, activeCount != null ? `Белсенді (${activeCount})` : "Белсенді", !archived)}
      {tab(`${basePath}?view=archived`, "Архив", archived)}
    </nav>
  );
}
