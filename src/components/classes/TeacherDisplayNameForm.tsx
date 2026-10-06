import { useRef, useState, type SyntheticEvent } from "react";

interface TeacherDisplayNameFormProps {
  displayName: string | null;
}

export default function TeacherDisplayNameForm({ displayName: initialDisplayName }: TeacherDisplayNameFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestInProgress = useRef(false);

  async function saveDisplayName(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedName = displayName.trim();
    if (!normalizedName || normalizedName.length > 80 || requestInProgress.current) return;

    requestInProgress.current = true;
    setSaving(true);
    setSaved(false);
    setError(false);
    try {
      const response = await fetch("/api/profile/display-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: normalizedName }),
      });
      const result = (await response.json()) as { displayName?: unknown };
      if (!response.ok || typeof result.displayName !== "string") {
        setError(true);
        return;
      }
      setDisplayName(result.displayName);
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      requestInProgress.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="rounded-md border p-5 sm:p-6">
      <h2 className="text-lg font-bold">Nazwa widoczna dla uczniów</h2>
      <p className="text-muted-foreground mt-1 text-sm leading-6">
        Ta nazwa będzie widoczna uczniom przed dołączeniem do Twojej klasy. Bez niej uczniowie zobaczą samą nazwę klasy.
      </p>
      {!initialDisplayName && (
        <p className="mt-3 text-sm font-medium">Dodaj nazwę, która będzie widoczna dla uczniów.</p>
      )}
      <form onSubmit={(event) => void saveDisplayName(event)} aria-busy={saving} className="mt-4">
        <label htmlFor="teacher-display-name" className="text-sm font-medium">
          Nazwa wyświetlana
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="teacher-display-name"
            name="displayName"
            autoComplete="name"
            maxLength={80}
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.currentTarget.value);
              setSaved(false);
              setError(false);
            }}
            className="border-input bg-background h-11 min-w-0 flex-1 rounded-md border px-3 text-sm"
          />
          <button
            type="submit"
            disabled={!displayName.trim() || displayName.trim().length > 80 || saving}
            className="bg-primary text-primary-foreground inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Zapisywanie..." : initialDisplayName ? "Zmień nazwę" : "Zapisz nazwę"}
          </button>
        </div>
        {saved && (
          <p role="status" className="text-primary mt-3 text-sm">
            Zapisano nazwę wyświetlaną.
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive mt-3 text-sm">
            Nie udało się zapisać nazwy. Spróbuj ponownie.
          </p>
        )}
      </form>
    </section>
  );
}
