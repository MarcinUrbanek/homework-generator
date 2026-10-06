import { useRef, useState, type SyntheticEvent } from "react";

import type { ClassJoinPreview } from "@/types";

interface InvitationJoinFormProps {
  token: string;
  preview: ClassJoinPreview;
  navigate?: (destination: string) => void;
}

export default function InvitationJoinForm({
  token,
  preview,
  navigate = (destination) => {
    window.location.assign(destination);
  },
}: InvitationJoinFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const submissionInProgress = useRef(false);

  async function joinClass(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submissionInProgress.current || joined) return;

    submissionInProgress.current = true;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/classes/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json()) as { redirectTo?: unknown };
      if (!response.ok || result.redirectTo !== "/classes/joined") {
        setErrorMessage("Nie udało się dołączyć do klasy. Sprawdź zaproszenie i spróbuj ponownie.");
        return;
      }
      setJoined(true);
      navigate(result.redirectTo);
    } catch {
      setErrorMessage("Nie udało się połączyć z usługą klas. Spróbuj ponownie.");
    } finally {
      submissionInProgress.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="invitation-class-name" className="mt-6 rounded-md border p-4">
      <h2 id="invitation-class-name" className="text-lg font-semibold">
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
        <form onSubmit={(event) => void joinClass(event)} aria-busy={submitting}>
          {errorMessage && (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {errorMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-primary-foreground mt-4 inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Dołączanie..." : preview.alreadyMember ? "Dołącz ponownie" : "Dołącz"}
          </button>
        </form>
      )}
    </section>
  );
}
