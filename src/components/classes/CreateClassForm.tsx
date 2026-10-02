import { useRef, useState } from "react";

import type { ClassApiError, ClassSummary, CreateClassSuccess } from "@/types";

interface CreateClassFormProps {
  onCreated: (classSummary: ClassSummary) => void;
}

export default function CreateClassForm({ onCreated }: CreateClassFormProps) {
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("Podaj nazwę klasy.");
      return;
    }

    submitting.current = true;
    setPending(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/classes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const value = (await response.json()) as unknown;
      const result = value as Partial<CreateClassSuccess> & Partial<ClassApiError>;
      if (!response.ok || !result.class) {
        setErrorMessage(result.error?.message ?? "Nie udało się utworzyć klasy.");
        return;
      }
      onCreated(result.class);
      setName("");
    } catch {
      setErrorMessage("Nie udało się połączyć z usługą klas.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3" noValidate>
      <label htmlFor="class-name" className="text-sm font-medium">
        Nazwa klasy
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="class-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          className="bg-background text-foreground min-h-11 flex-1 rounded-md border px-3"
          placeholder="np. 4A"
          disabled={pending}
          aria-describedby={errorMessage ? "create-class-error" : undefined}
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground min-h-11 rounded-md px-4 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Tworzenie..." : "Utwórz klasę"}
        </button>
      </div>
      {errorMessage && (
        <p id="create-class-error" role="alert" className="text-destructive text-sm">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
