import React, { useEffect, useState } from "react";
import { api } from "./api.js";
export default function AiReview({
  review,
  departments,
  formRef,
  disabled,
  onDismiss,
}) {
  const [mode, setMode] = useState(null);
  useEffect(() => {
    api("/ai/config")
      .then((config) => setMode(config.mode))
      .catch(() => setMode("unknown"));
  }, []);
  function apply() {
    const fields = formRef.current.elements;
    fields.namedItem("title").value = review.improvedTitle;
    fields.namedItem("description").value = review.improvedDescription;
    fields.namedItem("department").value = review.suggestedDepartmentSlug;
    fields.namedItem("priority").value = review.suggestedPriority;
    onDismiss();
  }
  return (
    <section className="ai-review" aria-label="Request checks">
      <p className="hint">
        {mode === "local"
          ? "Free local checks run when you send. They check basic completeness and placeholder text, not meaning or factual accuracy."
          : mode === "gemini"
            ? "Gemini AI reviews your draft when you send. Draft text is sent to Google. Free-tier content may be used to improve Google products; use sample, non-confidential requests."
            : mode === "openai"
              ? "OpenAI reviews your draft when you send. Draft text is sent to OpenAI."
              : "Request checking is configured by the server. Online review may send draft text to an external AI provider."}{" "}
        Requests that pass are submitted to the department. Staff accept the
        request, start work, and complete it. AI can make mistakes and does not
        verify facts.
      </p>
      {review && (
        <div aria-live="polite">
          <h3>Please check these details</h3>
          <ul>
            {review.concerns.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p>{review.explanation}</p>
          <h4>Suggested wording</h4>
          <strong>{review.improvedTitle}</strong>
          <p style={{ whiteSpace: "pre-wrap" }}>{review.improvedDescription}</p>
          <p>
            {
              departments.find((d) => d.slug === review.suggestedDepartmentSlug)
                ?.name
            }{" "}
            · {review.suggestedPriority} priority
          </p>
          <button type="button" disabled={disabled} onClick={apply}>
            Accept corrections
          </button>{" "}
          <button type="button" onClick={onDismiss}>
            Dismiss
          </button>
          <p className="hint">
            Resolve the concerns and send again. The checker will check the
            updated draft.
          </p>
        </div>
      )}
    </section>
  );
}
