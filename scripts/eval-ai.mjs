// Six live semantic cases and two deterministic boundary cases. No real DB writes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "../backend/node_modules/dotenv/lib/main.js";
import { AiController } from "../backend/dist/ai.controller.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "backend/.env"), quiet: true });
process.env.REQUEST_REVIEW_MODE = "gemini";
if (!process.env.GEMINI_API_KEY?.trim()) {
  console.error(
    "GEMINI_API_KEY is required for live evaluations. No results generated.",
  );
  process.exit(1);
}
const cases = JSON.parse(
  fs.readFileSync(path.join(root, "evals/request-intake.json"), "utf8"),
);
const catalog = [
  { slug: "it", name: "Information Technology" },
  { slug: "hr", name: "Human Resources" },
  { slug: "finance", name: "Finance" },
];
const originalFetch = globalThis.fetch;
const results = [];
for (const item of cases) {
  const { id, kind, expected, ...draft } = item;
  const problems = [];
  let calls = 0;
  let created = 0;
  let candidate;
  let status = 201;
  let submission;
  let failureReason;
  let providerMetadata;
  const start = Date.now();
  const db = {
    employee: { findUnique: async () => ({ id: "eval-employee" }) },
    department: { findMany: async () => catalog },
  };
  const service = {
    createRequest: async (employee, body) => {
      created++;
      if (
        employee !== "eval-employee" ||
        JSON.stringify(body) !== JSON.stringify(draft)
      )
        problems.push("Submitted draft was silently changed");
      return { ticketNumber: "EVAL-NOT-PERSISTED", status: "Submitted" };
    },
  };
  globalThis.fetch = async (url, options) => {
    calls++;
    if (!String(url).startsWith("https://generativelanguage.googleapis.com/"))
      throw new Error("Unexpected provider");
    const payload = JSON.parse(options.body);
    const sent = JSON.parse(payload.contents[0].parts[0].text);
    if (JSON.stringify(sent.departments) !== JSON.stringify(catalog))
      problems.push("Trusted catalog changed");
    if (JSON.stringify(sent).includes("eval-employee"))
      problems.push("Identity leaked into prompt");
    if (kind === "failure") return new Response("{}", { status: 429 });
    if (kind === "invalid")
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      improvedTitle: draft.title,
                      improvedDescription: draft.description,
                      suggestedDepartmentSlug: "invented-team",
                      suggestedPriority: "Critical",
                      explanation: "Invalid product values",
                      concerns: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    try {
      const response = await originalFetch(url, options);
      const data = await response
        .clone()
        .json()
        .catch(() => ({}));
      providerMetadata = {
        httpStatus: response.status,
        finishReason: data.candidates?.[0]?.finishReason,
        blockReason: data.promptFeedback?.blockReason,
        errorStatus: data.error?.status,
        usage: data.usageMetadata,
      };
      return response;
    } catch (error) {
      providerMetadata = { networkError: error.name };
      throw error;
    }
  };
  const controller = new AiController(db, service);
  const review = controller.review.bind(controller);
  controller.review = async (...args) => {
    candidate = await review(...args);
    return candidate;
  };
  try {
    submission = await controller.submit("eval-employee", draft);
  } catch (error) {
    status = typeof error.getStatus === "function" ? error.getStatus() : 500;
    failureReason =
      status === 504
        ? "Provider timed out after 60 seconds"
        : status === 503
          ? "Provider unavailable or quota exhausted"
          : status === 502
            ? "Provider failed or returned unusable output"
            : undefined;
  } finally {
    globalThis.fetch = originalFetch;
  }
  if (calls !== 1) problems.push(`Expected one provider call, got ${calls}`);
  if (expected.httpStatus && status !== expected.httpStatus)
    problems.push(`Expected HTTP ${expected.httpStatus}, got ${status}`);
  if (kind === "live") {
    if (!candidate)
      problems.push(
        `No validated candidate (HTTP ${status}${failureReason ? ": " + failureReason : ""})`,
      );
    else {
      if (
        expected.department &&
        candidate.suggestedDepartmentSlug !== expected.department
      )
        problems.push(`Expected department ${expected.department}`);
      if (
        expected.priorities &&
        !expected.priorities.includes(candidate.suggestedPriority)
      )
        problems.push("Priority does not reflect stated impact");
      if (expected.concerns === "none" && candidate.concerns.length)
        problems.push("Unnecessary clarification");
      if (expected.concerns === "some" && !candidate.concerns.length)
        problems.push("Missing clarification");
    }
  }
  if (
    expected.submission === "created" &&
    (created !== 1 || submission?.status !== "Submitted")
  )
    problems.push("Clear request did not enter Submitted");
  if (expected.submission === "blocked" && (created !== 0 || status < 400))
    problems.push("Blocked request reached persistence");
  const result = {
    id,
    kind,
    passed: problems.length === 0,
    httpStatus: status,
    ...(failureReason ? { failureReason } : {}),
    ...(providerMetadata ? { providerMetadata } : {}),
    persistenceCalls: created,
    durationMs: Date.now() - start,
    expected,
    problems,
    ...(candidate ? { candidate } : {}),
  };
  results.push(result);
  console.log(
    `${result.passed ? "PASS" : "FAIL"} ${id}${problems.length ? ": " + problems.join("; ") : ""}`,
  );
}
const report = {
  evaluatedAt: new Date().toISOString(),
  model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  command: "npm run eval:ai",
  liveCases: 6,
  injectedCases: 2,
  total: results.length,
  passed: results.filter((r) => r.passed).length,
  limitations:
    "Small synthetic rubric; checks routing, concerns and priority, not all factual accuracy or wording quality. Live outputs vary. No real database writes.",
  results,
};
fs.writeFileSync(
  path.join(root, "docs/week4-ai-eval-results.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `${report.passed}/${report.total} passed. Report: docs/week4-ai-eval-results.json`,
);
process.exitCode = report.passed === report.total ? 0 : 1;
