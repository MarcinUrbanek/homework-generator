// @ts-nocheck
import { useEffect, useState } from "react";

import CreateClassForm from "@/components/classes/CreateClassForm";
import InviteStudentsForm from "@/components/classes/InviteStudentsForm";
import type { ClassApiError, ClassSummary, ListClassesSuccess } from "@/types";

export default function ClassWorkspace() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const lifecycle = { active: true };
    void (async () => {
      try {
        const response = await fetch("/api/classes/list");
        const value = (await response.json()) as unknown;
        const result = value as Partial<ListClassesSuccess> & Partial<ClassApiError>;
        if (!response.ok || !result.classes) {
          if (lifecycle.active) setErrorMessage(result.error?.message ?? "Nie udało się pobrać klas.");
          return;
        }
        if (lifecycle.active) setClasses(result.classes);
      } catch {
        if (lifecycle.active) setErrorMessage("Nie udało się połączyć z usługą klas.");
      } finally {
        if (lifecycle.active) setLoaded(true);
      }
    })();
    return () => {
      lifecycle.active = false;
    };
  }, []);

  function addClass(classSummary: ClassSummary): void {
    setClasses((current) => [classSummary, ...current]);
  }

  return (
    <div className="grid gap-8">
      <section className="bg-card text-card-foreground rounded-lg border p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold">Nowa klasa</h2>
        <p className="text-muted-foreground mt-1 text-sm">Kod klasy zostanie wygenerowany automatycznie.</p>
        <div className="mt-5">
          <CreateClassForm onCreated={addClass} />
        </div>
      </section>

      <section aria-labelledby="classes-heading">
        <h2 id="classes-heading" className="text-xl font-bold">
          Twoje klasy
        </h2>
        {errorMessage && (
          <p role="alert" className="text-destructive mt-3 text-sm">
            {errorMessage}
          </p>
        )}
        {!loaded && <p className="text-muted-foreground mt-3 text-sm">Pobieranie klas...</p>}
        {loaded && !errorMessage && classes.length === 0 && (
          <p className="text-muted-foreground mt-3 text-sm">Nie utworzono jeszcze żadnej klasy.</p>
        )}
        <div className="mt-4 grid gap-4">
          {classes.map((classSummary) => (
            <section key={classSummary.id} className="bg-card text-card-foreground rounded-lg border p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h3 className="text-lg font-semibold">{classSummary.name}</h3>
                <p className="text-primary font-mono text-sm font-semibold">Kod: {classSummary.classCode}</p>
              </div>
              <InviteStudentsForm classId={classSummary.id} />
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
