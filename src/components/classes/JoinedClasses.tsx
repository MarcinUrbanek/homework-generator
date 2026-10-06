import { useEffect, useState } from "react";

import { joinedClassSummarySchema } from "@/lib/classes/schemas";
import type { JoinedClassSummary } from "@/types";

export default function JoinedClasses() {
  const [classes, setClasses] = useState<JoinedClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const lifecycle = { active: true };
    void (async () => {
      try {
        const response = await fetch("/api/classes/joined");
        const result = (await response.json()) as { classes?: unknown };
        const parsed = joinedClassSummarySchema.array().safeParse(result.classes);
        if (!response.ok || !parsed.success) {
          if (lifecycle.active) setError(true);
          return;
        }
        if (lifecycle.active) setClasses(parsed.data);
      } catch {
        if (lifecycle.active) setError(true);
      } finally {
        if (lifecycle.active) setLoading(false);
      }
    })();
    return () => {
      lifecycle.active = false;
    };
  }, []);

  return (
    <section aria-labelledby="joined-classes-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="joined-classes-heading" className="text-xl font-bold">
          Twoje klasy
        </h2>
        <a
          href="/classes/join-code"
          className="border-input inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Dołącz do klasy
        </a>
      </div>

      {loading && (
        <p role="status" className="text-muted-foreground mt-4 text-sm">
          Pobieranie klas...
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive mt-4 text-sm">
          Nie udało się pobrać Twoich klas. Spróbuj ponownie później.
        </p>
      )}
      {!loading && !error && classes.length === 0 && (
        <p className="text-muted-foreground mt-4 text-sm">Nie należysz jeszcze do żadnej klasy.</p>
      )}
      {!loading && !error && classes.length > 0 && (
        <ul className="mt-4 grid gap-3">
          {classes.map((classSummary) => (
            <li key={classSummary.id} className="rounded-md border p-4">
              <h3 className="text-lg font-semibold">{classSummary.name}</h3>
              {classSummary.teacherDisplayName && (
                <p className="text-muted-foreground mt-1 text-sm">Nauczyciel: {classSummary.teacherDisplayName}</p>
              )}
              <p className="text-muted-foreground mt-2 text-sm">
                Dołączono:{" "}
                <time dateTime={classSummary.joinedAt}>
                  {new Date(classSummary.joinedAt).toLocaleDateString("pl-PL")}
                </time>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
