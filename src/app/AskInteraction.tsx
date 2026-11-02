// pendingInteraction renderer for ba_ask: replaces the thread composer while
// the analyst waits for answers. Statuses follow askResponseSchema.
import { useState } from "react";
import type { PluginPendingInteractionProps } from "@get-bb/plugin-sdk/app";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildAskAnswers, parseAskPayload, type AskChoice, type AskQuestion } from "./helpers";
import { errorText } from "./data";
import { t } from "./i18n";
import { ErrorLine, Pill, TextArea } from "./ui";

export function AskInteraction({ interaction, submit, cancel }: PluginPendingInteractionProps) {
  const payload = parseAskPayload(interaction.payload);
  const [choices, setChoices] = useState<Record<string, AskChoice>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (payload === null) {
    return (
      <div className="bo-card m-2 flex flex-col gap-2 p-3">
        <ErrorLine error={t("askInvalid")} />
        <Button variant="outline" size="sm" className="bo-raised self-end" onClick={() => void cancel()}>
          {t("askSkip")}
        </Button>
      </div>
    );
  }

  const send = async (skipAll: boolean) => {
    setPending(true);
    setError(null);
    try {
      await submit({ answers: buildAskAnswers(payload.questions, skipAll ? {} : choices) });
    } catch (cause) {
      setError(errorText(cause));
      setPending(false);
    }
  };

  return (
    <form
      className="bo-panel m-2 flex max-h-[60vh] flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void send(false);
      }}
    >
      <div className="bo-panel-head">
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{payload.title}</h2>
      </div>
      <div className="bo-panel-body flex min-h-0 flex-col gap-4 overflow-y-auto">
        {payload.questions.map((question) => (
          <QuestionBlock
            key={question.id}
            question={question}
            choice={choices[question.id] ?? { kind: "none" }}
            onChange={(choice) => setChoices((current) => ({ ...current, [question.id]: choice }))}
          />
        ))}
        {error !== null ? <ErrorLine error={error} /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => void send(true)}
          >
            {t("askSkip")}
          </Button>
          <Button type="submit" size="sm" className="bo-accent" disabled={pending}>
            {pending ? t("askSubmitting") : t("askSubmit")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function QuestionBlock({
  question,
  choice,
  onChange,
}: {
  question: AskQuestion;
  choice: AskChoice;
  onChange: (choice: AskChoice) => void;
}) {
  const name = `bo-ask-${question.id}`;
  const optionRow = (checked: boolean) =>
    cn(
      "flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-sm",
      checked ? "bo-raised" : "hover:bg-muted/40",
    );
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium">{question.question}</legend>
      {question.why === undefined ? null : (
        <p className="text-xs text-muted-foreground">
          {t("askWhy")}: {question.why}
        </p>
      )}
      {question.options.map((option, index) => {
        const checked = choice.kind === "option" && choice.index === index;
        return (
          <label key={index} className={optionRow(checked)}>
            <input
              type="radio"
              name={name}
              className="mt-1"
              checked={checked}
              onChange={() => onChange({ kind: "option", index })}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="break-words">{option.label}</span>
                {option.recommended === true ? <Pill tone="info">{t("askRecommended")}</Pill> : null}
              </span>
              {option.description === undefined ? null : (
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              )}
            </span>
          </label>
        );
      })}
      {question.allowFreeText ? (
        <div className={optionRow(choice.kind === "text")}>
          {question.options.length === 0 ? null : (
            <input
              type="radio"
              name={name}
              className="mt-1"
              aria-label={t("askOther")}
              checked={choice.kind === "text"}
              onChange={() => onChange({ kind: "text", text: choice.kind === "text" ? choice.text : "" })}
            />
          )}
          <TextArea
            aria-label={question.options.length === 0 ? question.question : t("askOther")}
            placeholder={question.options.length === 0 ? t("askOtherPlaceholder") : t("askOther")}
            className="min-h-14"
            maxLength={4000}
            value={choice.kind === "text" ? choice.text : ""}
            onFocus={() => {
              if (choice.kind !== "text") onChange({ kind: "text", text: "" });
            }}
            onChange={(event) => onChange({ kind: "text", text: event.target.value })}
          />
        </div>
      ) : null}
      {question.allowUnknown ? (
        <label className={optionRow(choice.kind === "unknown")}>
          <input
            type="radio"
            name={name}
            className="mt-1"
            checked={choice.kind === "unknown"}
            onChange={() => onChange({ kind: "unknown" })}
          />
          <span className="text-muted-foreground">{t("askUnknown")}</span>
        </label>
      ) : null}
    </fieldset>
  );
}
