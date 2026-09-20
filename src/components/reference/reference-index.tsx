import { MethodLabel, PathText } from "@/components/domain/method-label";
import type { DocSection } from "@/lib/docs";

/** The left index: resources, each with its endpoints, all anchor links into the body. */
export function ReferenceIndex({ sections }: { sections: DocSection[] }) {
  return (
    <nav aria-label="Reference sections" className="w-full lg:sticky lg:top-20 lg:w-[220px] lg:shrink-0 lg:self-start">
      <ul className="space-y-4 text-sm">
        <li>
          <a
            href="#introduction"
            className="block rounded-md px-2 py-1 text-ink-3 transition-colors duration-150 hover:bg-panel hover:text-ink"
          >
            Introduction
          </a>
        </li>
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="block truncate rounded-md px-2 py-1 font-medium text-ink transition-colors duration-150 hover:bg-panel"
            >
              {s.title}
            </a>
            {s.endpoints.length > 0 && (
              <ul className="mt-1 space-y-0.5 border-l border-line pl-2">
                {s.endpoints.map((e) => (
                  <li key={e.route.id}>
                    <a
                      href={`#${e.route.id}`}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-ink-3 transition-colors duration-150 hover:bg-panel hover:text-ink"
                    >
                      <MethodLabel method={e.route.method} />
                      <PathText path={e.route.path} className="truncate text-xs" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
