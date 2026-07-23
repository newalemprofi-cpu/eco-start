// Client-safe home for the group age-category enum, mirroring
// news-categories.ts's rationale: groups-manager.tsx ("use client")
// needs this as a runtime value; importing it from db/repo/groups.ts
// directly would drag that file's `server-only` + postgres client into
// the browser bundle.
export const GROUP_AGE_CATEGORIES = ["MIDDLE_3", "SENIOR_4", "PRESCHOOL_5"] as const;
export type GroupAgeCategory = (typeof GROUP_AGE_CATEGORIES)[number];

export const GROUP_AGE_CATEGORY_LABEL: Record<GroupAgeCategory, string> = {
  MIDDLE_3: "Ортаңғы топ",
  SENIOR_4: "Ересек топ",
  PRESCHOOL_5: "Мектепалды топ",
};

export const GROUP_AGE_CATEGORY_DESCRIPTION: Record<GroupAgeCategory, string> = {
  MIDDLE_3: "3 жас",
  SENIOR_4: "4 жас",
  PRESCHOOL_5: "5 жас",
};
