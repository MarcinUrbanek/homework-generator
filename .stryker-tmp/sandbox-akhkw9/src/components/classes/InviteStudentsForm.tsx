// @ts-nocheck
import { useMemo, useRef, useState } from "react";

import type { ClassApiError, InvitationDeliveryResult, InviteStudentsSuccess } from "@/types";

interface InviteStudentsFormProps {
  classId: string;
}

export function parseInvitationEmails(value: string): string[] {
  const normalized = value
    .split(/[\n,]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(normalized)];
}

export default function InviteStudentsForm({ classId }: InviteStudentsFormProps) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<InvitationDeliveryResult[]>([]);
  const submitting = useRef(false);
  const emails = useMemo(() => parseInvitationEmails(value), [value]);
  const isOverLimit = emails.length > 50;

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (emails.length === 0) {
      setErrorMessage("Dodaj co najmniej jeden adres e-mail.");
      return;
    }
    if (isOverLimit) {
      setErrorMessage("Jednorazowo można wysłać maksymalnie 50 zaproszeń.");
      return;
    }

    submitting.current = true;
    setPending(true);
    setErrorMessage(null);
    setResults([]);
    try {
      const response = await fetch("/api/classes/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, emails }),
      });
      const value = (await response.json()) as unknown;
      const result = value as Partial<InviteStudentsSuccess> & Partial<ClassApiError>;
      if (!response.ok || !result.results) {
        setErrorMessage(result.error?.message ?? "Nie udało się wysłać zaproszeń.");
        return;
      }
      setResults(result.results);
    } catch {
      setErrorMessage("Nie udało się połączyć z usługą zaproszeń.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 grid gap-3" noValidate>
      <label htmlFor={`invite-students-${classId}`} className="text-sm font-medium">
        Adresy e-mail uczniów
      </label>
      <textarea
        id={`invite-students-${classId}`}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        className="bg-background text-foreground min-h-28 w-full rounded-md border px-3 py-2"
        placeholder="uczen@example.com, druga.osoba@example.com"
        disabled={pending}
        aria-describedby={`invite-preview-${classId}`}
      />
      <p
        id={`invite-preview-${classId}`}
        className={isOverLimit ? "text-destructive text-sm" : "text-muted-foreground text-sm"}
      >
        Unikalni odbiorcy: {emails.length}/50
      </p>
      {emails.length > 0 && (
        <ul aria-label="Podgląd odbiorców" className="text-muted-foreground flex flex-wrap gap-2 text-sm">
          {emails.map((email) => (
            <li key={email} className="rounded-md border px-2 py-1">
              {email}
            </li>
          ))}
        </ul>
      )}
      <button
        type="submit"
        disabled={pending || isOverLimit}
        className="bg-primary text-primary-foreground min-h-11 justify-self-start rounded-md px-4 text-sm font-semibold disabled:opacity-60"
      >
        {pending ? "Wysyłanie..." : "Wyślij zaproszenia"}
      </button>
      {errorMessage && (
        <p role="alert" className="text-destructive text-sm">
          {errorMessage}
        </p>
      )}
      {results.length > 0 && (
        <ul aria-label="Wyniki wysyłki" className="grid gap-2 text-sm">
          {results.map((result) => (
            <li key={result.email} className="flex flex-wrap justify-between gap-2 rounded-md border px-3 py-2">
              <span>{result.email}</span>
              <span className={result.status === "failed" ? "text-destructive" : "text-primary"}>
                {result.status === "sent" ? "Wysłano" : result.status === "refreshed" ? "Odświeżono" : "Nie wysłano"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
