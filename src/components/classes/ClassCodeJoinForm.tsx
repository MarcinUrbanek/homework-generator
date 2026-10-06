import { useRef, useState, type SyntheticEvent } from "react";

import { classJoinPreviewSchema } from "@/lib/classes/schemas";
import type { ClassJoinPreview } from "@/types";

interface ClassCodeJoinFormProps {
  navigate?: (destination: string) => void;
}

export default function ClassCodeJoinForm({
  navigate = (destination) => {
    window.location.assign(destination);
  },
}: ClassCodeJoinFormProps) {
  const [classCode, setClassCode] = useState("");
  const [preview, setPreview] = useState<ClassJoinPreview | null>(null);
  const [previewedCode, setPreviewedCode] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [joining, setJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const requestInProgress = useRef(false);
  const normalizedCode = classCode.replace(/\s+/g, "").toUpperCase();
  const validCode = /^[A-Z0-9]{8}$/.test(normalizedCode);

  async function previewClass(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!validCode || requestInProgress.current) return;

    const requestedCode = normalizedCode;
    requestInProgress.current = true;
    setLoadingPreview(true);
    setErrorMessage(null);
    setPreview(null);
    setPreviewedCode(null);
    try {
      const response = await fetch("/api/classes/preview-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classCode: requestedCode }),
      });
      const result = (await response.json()) as { class?: unknown };
      const parsedPreview = classJoinPreviewSchema.safeParse(result.class);
      if (!response.ok || !parsedPreview.success) {
        setErrorMessage("Nie udało się znaleźć klasy. Sprawdź kod i spróbuj ponownie.");
        return;
      }
      setPreview(parsedPreview.data);
      setPreviewedCode(requestedCode);
    } catch {
      setErrorMessage("Nie udało się połączyć z usługą klas. Spróbuj ponownie.");
    } finally {
      requestInProgress.current = false;
      setLoadingPreview(false);
    }
  }

  async function confirmJoin(): Promise<void> {
    if (!preview || previewedCode !== normalizedCode || requestInProgress.current || joined) return;

    requestInProgress.current = true;
    setJoining(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/classes/join-by-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classCode: previewedCode }),
      });
      const result = (await response.json()) as { redirectTo?: unknown };
      if (!response.ok || result.redirectTo !== "/classes/joined") {
        setErrorMessage("Nie udało się dołączyć do klasy. Sprawdź kod i spróbuj ponownie.");
        return;
      }
      setJoined(true);
      navigate(result.redirectTo);
    } catch {
      setErrorMessage("Nie udało się połączyć z usługą klas. Spróbuj ponownie.");
    } finally {
      requestInProgress.current = false;
      setJoining(false);
    }
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={(event) => void previewClass(event)} aria-busy={loadingPreview}>
        <label htmlFor="class-code" className="text-sm font-medium">
          Kod klasy
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="class-code"
            name="classCode"
            autoComplete="off"
            maxLength={16}
            value={classCode}
            onChange={(event) => {
              setClassCode(event.currentTarget.value);
              setPreview(null);
              setPreviewedCode(null);
              setErrorMessage(null);
            }}
            className="border-input bg-background h-11 min-w-0 flex-1 rounded-md border px-3 text-sm uppercase"
          />
          <button
            type="submit"
            disabled={!validCode || loadingPreview || joining}
            className="bg-primary text-primary-foreground inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPreview ? "Sprawdzanie..." : "Sprawdź kod"}
          </button>
        </div>
      </form>

      {errorMessage && (
        <p role="alert" className="text-destructive text-sm">
          {errorMessage}
        </p>
      )}

      {preview && previewedCode === normalizedCode && (
        <section aria-labelledby="preview-class-name" className="rounded-md border p-4">
          <h2 id="preview-class-name" className="text-lg font-semibold">
            {preview.name}
          </h2>
          {preview.teacherDisplayName && (
            <p className="text-muted-foreground mt-1 text-sm">Nauczyciel: {preview.teacherDisplayName}</p>
          )}
          {joined ? (
            <a
              href="/classes/joined"
              className="bg-primary text-primary-foreground mt-4 inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold"
            >
              Przejdź do swoich klas
            </a>
          ) : (
            <button
              type="button"
              onClick={() => void confirmJoin()}
              disabled={joining}
              className="bg-primary text-primary-foreground mt-4 inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joining ? "Dołączanie..." : preview.alreadyMember ? "Dołącz ponownie" : "Dołącz"}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
