import {
  BarChart3,
  Baby,
  Bug,
  Building2,
  Camera,
  CloudSun,
  Compass,
  Droplets,
  Factory,
  Flower2,
  Gamepad2,
  GraduationCap,
  LineChart,
  Map,
  Music2,
  Palette,
  PawPrint,
  Puzzle,
  Rocket,
  ShieldCheck,
  Sparkles,
  Sprout,
  TreePine,
  Trophy,
  UsersRound,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * CMS content (homepage_modules.icon, homepage_role_cards.icon,
 * homepage_sections.icon) stores icon choices as plain string names so
 * SUPER_ADMIN can pick one from a dropdown without shipping code. This
 * maps those names back to the actual Lucide component for rendering.
 * Keep in sync with the icon picker in the SUPER_ADMIN module/role-card
 * editors — an unknown name safely falls back to Sparkles rather than
 * crashing the page.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  Camera,
  Sprout,
  Trophy,
  Palette,
  LineChart,
  GraduationCap,
  UsersRound,
  BarChart3,
  Baby,
  ShieldCheck,
  Sparkles,
  Rocket,
  Gamepad2,
  TreePine,
  Droplets,
  Flower2,
  Bug,
  Compass,
  Map,
  Factory,
  Waves,
  Zap,
  PawPrint,
  CloudSun,
  Building2,
  Puzzle,
  Music2,
};

export function resolveIcon(name: string | null | undefined): LucideIcon {
  return (name && ICON_MAP[name]) || Sparkles;
}

export const ICON_NAMES = Object.keys(ICON_MAP);

/**
 * Renders a CMS-selected icon by name. A lowercase helper (not a
 * PascalCase component) on purpose — assigning the resolved icon to a
 * local variable and rendering it as a JSX tag inside a real component
 * trips the react-hooks/static-components lint rule ("component
 * created during render"), so every call site renders through this
 * function instead of doing `const Icon = resolveIcon(x)` itself.
 */
export function renderIcon(name: string | null | undefined, className?: string) {
  const Icon = resolveIcon(name);
  return <Icon className={className} />;
}
