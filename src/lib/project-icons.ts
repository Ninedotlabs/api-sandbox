/**
 * The project icon library.
 *
 * Every icon is the same isometric tile with a different glyph on its top face, so a list
 * of them reads as one set rather than a scrapbook: one light source, one geometry, one
 * glyph weight. The tile is drawn in `ProjectIcon`; this file owns only the vocabulary —
 * which icons exist, what each is called, and which colour family it wears.
 *
 * A project that has never chosen an icon still gets one: `resolveProjectIcon` picks
 * deterministically from the project's slug, so the same API always wears the same face,
 * on every device, with nothing stored. Choosing an icon writes `projects.icon`, and that
 * choice then wins forever.
 */

export type IconFamily = "blue" | "mint" | "pink" | "violet" | "amber" | "teal" | "orange" | "slate";

export interface IconFamilyTones {
  /** The lit top face, the shaded left face, the mid-tone right face. */
  top: string;
  left: string;
  right: string;
  /** The glyph's colour on that top face - dark on the light families, white on the dark
   * ones - so no icon ends up as a pale shape on a pale tile. */
  ink: string;
}

export const ICON_FAMILIES: Record<IconFamily, IconFamilyTones> = {
  blue: { top: "#5b7bff", left: "#1b3bb5", right: "#2449d8", ink: "#ffffff" },
  mint: { top: "#2ad3ab", left: "#0b8b6e", right: "#0fb790", ink: "#06382c" },
  pink: { top: "#ff8fae", left: "#c22a52", right: "#e03462", ink: "#4a0c1e" },
  violet: { top: "#9b7eff", left: "#5b3fe0", right: "#7a5cff", ink: "#ffffff" },
  amber: { top: "#ffe089", left: "#c79400", right: "#e8ae00", ink: "#4a3600" },
  teal: { top: "#3ddbdb", left: "#0a7d7d", right: "#0e9c9c", ink: "#043535" },
  orange: { top: "#ffa87a", left: "#c2521f", right: "#e0662b", ink: "#4a1c05" },
  slate: { top: "#94a3b8", left: "#475569", right: "#64748b", ink: "#111a26" },
};

export interface ProjectIconDefinition {
  id: string;
  /** What a person would call it when hunting through the picker. */
  label: string;
  family: IconFamily;
  /** Groups the picker, so 24 icons are scannable instead of a wall. */
  group: "General" | "Commerce" | "Media" | "People" | "Systems";
}

export const PROJECT_ICONS: readonly ProjectIconDefinition[] = [
  { id: "cube", label: "Cube", family: "blue", group: "General" },
  { id: "layers", label: "Layers", family: "violet", group: "General" },
  { id: "grid", label: "Grid", family: "teal", group: "General" },
  { id: "bolt", label: "Bolt", family: "amber", group: "General" },
  { id: "sparkle", label: "Sparkle", family: "pink", group: "General" },
  { id: "flask", label: "Flask", family: "mint", group: "General" },

  { id: "cart", label: "Cart", family: "orange", group: "Commerce" },
  { id: "tag", label: "Price tag", family: "pink", group: "Commerce" },
  { id: "card", label: "Card", family: "blue", group: "Commerce" },
  { id: "package", label: "Package", family: "amber", group: "Commerce" },
  { id: "ticket", label: "Ticket", family: "violet", group: "Commerce" },
  { id: "chart", label: "Chart", family: "mint", group: "Commerce" },

  { id: "music", label: "Music", family: "pink", group: "Media" },
  { id: "camera", label: "Camera", family: "slate", group: "Media" },
  { id: "book", label: "Book", family: "teal", group: "Media" },
  { id: "image", label: "Image", family: "violet", group: "Media" },
  { id: "play", label: "Play", family: "orange", group: "Media" },
  { id: "mic", label: "Microphone", family: "blue", group: "Media" },

  { id: "user", label: "Person", family: "blue", group: "People" },
  { id: "chat", label: "Chat", family: "mint", group: "People" },
  { id: "calendar", label: "Calendar", family: "orange", group: "People" },
  { id: "pin", label: "Location", family: "pink", group: "People" },

  { id: "database", label: "Database", family: "slate", group: "Systems" },
  { id: "cloud", label: "Cloud", family: "teal", group: "Systems" },
  { id: "key", label: "Key", family: "amber", group: "Systems" },
  { id: "shield", label: "Shield", family: "violet", group: "Systems" },
  { id: "terminal", label: "Terminal", family: "slate", group: "Systems" },
  { id: "gear", label: "Gear", family: "blue", group: "Systems" },
];

export const PROJECT_ICON_IDS: readonly string[] = PROJECT_ICONS.map((icon) => icon.id);

export function isProjectIconId(value: unknown): value is string {
  return typeof value === "string" && PROJECT_ICON_IDS.includes(value);
}

/** djb2. Small, stable across runtimes, and good enough to spread names over 28 buckets. */
function hash(text: string): number {
  let value = 5381;
  for (let i = 0; i < text.length; i++) value = ((value << 5) + value + text.charCodeAt(i)) >>> 0;
  return value;
}

/**
 * The icon a project wears: its own choice if it made one, otherwise a stable pick from its
 * slug. Falls back to the same derivation when a stored id is no longer in the library, so
 * retiring an icon can never leave a project without a face.
 */
export function resolveProjectIcon(project: { slug: string; icon?: string | null }): ProjectIconDefinition {
  if (isProjectIconId(project.icon)) {
    return PROJECT_ICONS.find((icon) => icon.id === project.icon)!;
  }
  return PROJECT_ICONS[hash(project.slug) % PROJECT_ICONS.length];
}
