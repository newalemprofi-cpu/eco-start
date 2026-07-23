import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveBrand } from "@/lib/theme/active-theme";

export async function Logo({
  className,
  variant = "default",
}: {
  className?: string;
  /** "footer" uses the dedicated footer logo when SUPER_ADMIN has uploaded one. */
  variant?: "default" | "footer";
}) {
  const brand = await getActiveBrand();
  const logoUrl = variant === "footer" ? (brand.footer_logo_url ?? brand.logo_url) : brand.logo_url;

  return (
    <span className={cn("inline-flex items-center gap-2 font-heading font-bold", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={brand.site_name} className="h-8 w-auto rounded-lg" />
      ) : (
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Sprout className="size-5" />
        </span>
      )}
      <span className="text-lg tracking-tight">{brand.site_name}</span>
    </span>
  );
}
