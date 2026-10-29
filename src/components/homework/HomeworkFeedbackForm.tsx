import { CheckCircle2, LoaderCircle, Save, Trash2 } from "lucide-react";
import { useId, useRef, useState, type SubmitEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { homeworkFeedbackSuccessSchema, trimHomeworkFeedback } from "@/lib/homework/review-schemas";
import { HOMEWORK_FEEDBACK_MAX_LENGTH } from "@/lib/homework/schemas";
import { cn } from "@/lib/utils";
import type { HomeworkFeedback } from "@/types";

interface HomeworkFeedbackFormProps {
  assignmentId: string;
  studentId: string;
  initialFeedback: HomeworkFeedback | null;
}

type FormStatus = "idle" | "saving" | "saved" | "cleared" | "invalid" | "conflict" | "error";

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Warsaw",
});

export default function HomeworkFeedbackForm({ assignmentId, studentId, initialFeedback }: HomeworkFeedbackFormProps) {
  const fieldId = useId();
  const [value, setValue] = useState(initialFeedback?.body ?? "");
  const [feedback, setFeedback] = useState(initialFeedback);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const saving = useRef(false);

  const length = trimHomeworkFeedback(value).length;
  const tooLong = length > HOMEWORK_FEEDBACK_MAX_LENGTH;
  const locked = status === "conflict";

  async function save(body: string): Promise<void> {
    if (saving.current || locked) return;
    saving.current = true;
    setStatus("saving");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/homework/${encodeURIComponent(assignmentId)}/students/${encodeURIComponent(studentId)}/feedback`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: body }),
        },
      );
      const payload: unknown = await response.json().catch(() => null);

      if (response.ok) {
        const parsed = homeworkFeedbackSuccessSchema.safeParse(payload);
        if (!parsed.success) {
          setStatus("error");
          setMessage("Nie udało się potwierdzić zapisu komentarza. Spróbuj ponownie.");
          return;
        }
        setFeedback(parsed.data.feedback);
        setValue(parsed.data.feedback?.body ?? "");
        setStatus(parsed.data.feedback ? "saved" : "cleared");
        setMessage(parsed.data.feedback ? "Komentarz zapisany." : "Komentarz usunięty.");
        return;
      }

      if (response.status === 409) {
        setStatus("conflict");
        setMessage("Nie można już dodać komentarza. Uczeń mógł opuścić klasę.");
        return;
      }
      if (response.status === 400) {
        setStatus("invalid");
        setMessage(`Komentarz jest nieprawidłowy. Może mieć najwyżej ${String(HOMEWORK_FEEDBACK_MAX_LENGTH)} znaków.`);
        return;
      }
      setStatus("error");
      setMessage(
        response.status === 404 || response.status === 403
          ? "To zadanie nie jest już dostępne. Odśwież stronę."
          : "Nie udało się zapisać komentarza. Spróbuj ponownie.",
      );
    } catch {
      setStatus("error");
      setMessage("Nie udało się połączyć z usługą. Spróbuj ponownie.");
    } finally {
      saving.current = false;
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (tooLong) {
      setStatus("invalid");
      setMessage(`Komentarz może mieć najwyżej ${String(HOMEWORK_FEEDBACK_MAX_LENGTH)} znaków.`);
      return;
    }
    if (length === 0) {
      setStatus("invalid");
      setMessage("Wpisz komentarz przed zapisaniem.");
      return;
    }
    void save(value);
  }

  function handleClear(): void {
    void save("");
  }

  const isSaving = status === "saving";
  const descriptionId = `${fieldId}-description`;
  const messageId = `${fieldId}-message`;

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <Field>
        <FieldLabel htmlFor={fieldId}>Komentarz dla ucznia</FieldLabel>
        <textarea
          id={fieldId}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (status === "invalid" || status === "saved" || status === "cleared") {
              setStatus("idle");
              setMessage(null);
            }
          }}
          aria-describedby={message ? `${descriptionId} ${messageId}` : descriptionId}
          aria-invalid={tooLong || status === "invalid"}
          disabled={isSaving || locked}
          className={cn(
            "bg-background text-foreground min-h-36 w-full rounded-md border px-3 py-2",
            tooLong && "border-destructive",
          )}
          placeholder="Napisz, co poszło dobrze i co warto poprawić."
        />
        <FieldDescription id={descriptionId} className={cn(tooLong && "text-destructive")}>
          {length}/{HOMEWORK_FEEDBACK_MAX_LENGTH} znaków
          {feedback && (
            <>
              {" · "}Ostatnia zmiana:{" "}
              <time dateTime={feedback.updatedAt}>{dateFormatter.format(new Date(feedback.updatedAt))}</time>
            </>
          )}
        </FieldDescription>
      </Field>

      {message && (
        <Alert
          id={messageId}
          variant={status === "saved" || status === "cleared" ? "default" : "destructive"}
          role={status === "saved" || status === "cleared" ? "status" : "alert"}
        >
          {status === "saved" || status === "cleared" ? <CheckCircle2 aria-hidden="true" /> : null}
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" className="min-h-11" disabled={isSaving || locked || tooLong}>
          {isSaving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {isSaving ? "Zapisywanie..." : "Zapisz komentarz"}
        </Button>
        {feedback && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={isSaving || locked}
            onClick={handleClear}
          >
            <Trash2 aria-hidden="true" />
            Usuń komentarz
          </Button>
        )}
      </div>
    </form>
  );
}
