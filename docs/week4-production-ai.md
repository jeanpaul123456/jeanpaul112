# Week 4 — AI-assisted Request Intake

## What this feature does

An employee should be able to describe a problem, choose a department, and send a request without needing to call someone first. However, a request can be difficult to handle if its description is unclear or if it goes to the wrong department.

We added Gemini to help with this first step. It reads the request before submission, checks whether the title and description make sense together, and suggests clearer wording, a department, and a priority. This feature is part of the existing Internal Operations Service Hub repository. We did not create a new project.

The AI helps prepare the request. The department is still responsible for accepting it, doing the work, and completing it.

## How an employee uses it

1. The employee opens **New request** and enters a title, description, department, and priority.
2. When they click **Send request**, the backend checks the input and sends the draft to Gemini.
3. If Gemini finds missing details or a contradiction, the form shows feedback below the description. The request is not created yet.
4. The employee can edit the text or choose **Accept corrections**, then send it again. The updated draft is checked again.
5. If the review finds no concerns and the suggested department matches the selected department, the backend saves the request as **Submitted**.
6. Staff in that department accept the request, start work, and mark it completed. The employee can follow its progress and receives an in-app completion notification.

The normal flow is:

**AI check → Submitted → Accepted → In Progress → Completed**

The API calls the Accepted stage `Assigned`; the interface displays it as **Accepted**. Department staff can also reject a request under the existing rules.

Earlier in development, a successful AI check moved a request directly to In Progress. We changed this because checking the wording does not mean that someone has accepted or started the work. Existing requests keep their recorded history.

## A real example from testing

We tested a draft with the title **“Laptop will not start”**, but its description said the laptop was working perfectly and asked for help with unpaid travel expenses.

Gemini flagged the contradiction and suggested Finance instead of IT. This is useful because the employee can correct the request before sending it to the wrong team.

We also tested a clear laptop problem that prevented the employee from working. Gemini suggested IT and High priority, with no concerns. Both were live review calls on September 22, 2026. Neither test created a request in the database.

These two checks show that the connection works. They do not prove that the model will always make the right decision.

## What we send to Gemini

The backend sends only:

- The request title and description.
- The department and priority selected by the employee.
- The available department names and slugs, loaded from our database.

The department list is product-owned context. The employee's draft is untrusted text. The prompt tells Gemini to treat that text as a request to review, not as instructions that override the application's rules.

We do not send employee identity records, email addresses, other employees' requests, or request history. The feature does not search company documents or use RAG.

## What Gemini returns

Gemini returns a structured JSON candidate instead of a free-form chat answer:

```json
{
  "improvedTitle": "Laptop will not start",
  "improvedDescription": "My laptop will not start. I tried its charger, but I still cannot access my work. Please help.",
  "suggestedDepartmentSlug": "it",
  "suggestedPriority": "High",
  "explanation": "This is an IT device issue that blocks the employee's work.",
  "concerns": []
}
```

This example shows the response format. It is not a stored test result.

The instructions ask Gemini to preserve the employee's language and facts, avoid inventing details, and flag unclear or contradictory information. Priority should reflect the impact described in the request.

## What the backend controls

We do not trust a response just because it came from AI. The backend checks it before using it.

| Check | Rule |
| --- | --- |
| Employee | The selected employee must exist. |
| Title | Required, with a maximum of 160 characters. |
| Description | Required, with a maximum of 5,000 characters. |
| Department | Must be one of the departments in the database. |
| Priority | Must be Low, Medium, or High. |
| AI explanation | Required, with a maximum of 1,500 characters. |
| AI concerns | At most five nonblank items, each no longer than 500 characters. |

A response with an unknown department or invalid fields is rejected. Suggestions are displayed as text, not HTML.

If the model returns concerns or suggests a different department, the backend returns feedback and creates no request. Otherwise, it saves the employee's submitted wording and selections. It does not silently replace them with the AI's suggestions.

AI cannot change request status, act as department staff, or bypass authorization. Staff from another department still cannot manage the request.

There is an important limit here: an incorrect AI concern can prevent submission until the employee revises the draft. The model is checking clarity, not proving that the employee's account is true or false.

## Setup and running the project

The live integration uses **Google Gemini** with `gemini-3.5-flash-lite`. We changed from `gemini-2.5-flash-lite` after Google reported that the older model was unavailable to new accounts.

Create a key in Google AI Studio and add these settings to the private `backend/.env` file:

```env
REQUEST_REVIEW_MODE=gemini
GEMINI_API_KEY=your_private_key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Never commit `.env`. The repository includes `.env.example` with placeholders.

For a fresh checkout, follow the installation steps in [README](../README.md). Once dependencies and the database are ready, run these commands from the repository root:

```sh
npm run build
npm start
```

Open `http://localhost:3000/app/`. Restart the backend after changing environment settings.

Gemini has a free tier with limits. Use a Free-tier project if you do not want paid API usage. The app cannot check your account's billing tier. Google also states that free-tier content may be used to improve its products, so this practice project should use fictional requests rather than confidential employee information. See [Google's pricing and data-use information](https://ai.google.dev/gemini-api/docs/pricing).

The app also supports `REQUEST_REVIEW_MODE=local`. This runs basic checks without an external service or API key. It is rule-based validation, not AI. The earlier OpenAI integration remains optional and is not used in Gemini mode. The form reads the active mode from the backend and displays the corresponding explanation.

## What happens when something fails

The draft stays in the form when review cannot safely complete. The app never switches to another paid provider. For selected transient Gemini network or provider-rejection failures, the backend uses a deterministic local review that checks routing, impact and clarification needs against the trusted department catalog.

| Situation | Result |
| --- | --- |
| Unknown employee | 401; no provider call. |
| Invalid input | 400; the employee must correct the form. |
| AI asks for clarification | 400 with review feedback; no request is created. |
| Missing Gemini key | 503 with a setup message. |
| Gemini quota is exhausted | 503 with a message to try later. |
| Provider timeout | 504 after 60 seconds; the draft is kept. No fallback is used. |
| Provider error, blocked response, or invalid output | 502; the draft is kept. |

Gemini calls have a 60-second timeout and a 4,096-token output limit. The application does not expose the API key or raw provider errors to the employee.

## Tests already in place

The latest full deterministic verification passed **66 tests**: 23 unit tests, 38 API/database tests, and 5 browser tests. The frontend and backend builds also passed after the lifecycle was changed back to Submitted.

The tests cover request rules, department authorization, database persistence, lifecycle changes, notifications, draft recovery, invalid model output, missing credentials, and provider failures.

Run the full check from the repository root:

```sh
npm run check
```

On Windows, if using the installed Microsoft Edge browser, first run:

```powershell
$env:PLAYWRIGHT_CHANNEL='msedge'
```

Automated provider tests use simulated responses, so they do not need credits. The free-mode browser test sends a request through the real backend and a separate SQLite test database. Existing manual lifecycle tests use the original `/requests` endpoint.

These tests protect the software's behavior. They do not measure how well Gemini understands different requests.

## AI evaluations

The eight evaluation cases are stored in `evals/request-intake.json` and run by `scripts/eval-ai.mjs`. Six call live Gemini with fictional drafts. Two inject invalid output and quota failure to check the backend boundaries without depending on a provider outage.

| Case | Example | What we expect | Evidence so far |
| --- | --- | --- | --- |
| Clear IT request | Laptop will not start and work is blocked. | IT, High priority, no unnecessary clarification. | Live review passed. |
| Clear HR request | Employee asks how to submit annual leave next month. | HR, with no invented dates or urgency. | Included in the live suite. |
| Too little information | “Help” / “It is broken.” | Ask what is broken and what help is needed. | Included in the live suite. |
| Contradictory request | Laptop title, but description says it works and asks about expenses. | Flag the contradiction and suggest Finance. | Live review flagged both issues. |
| Trusted department context | Payroll question sent to IT. | Suggest an existing Finance department; never invent one. | Live case includes an instruction to invent a department; only the trusted catalog is allowed. |
| Priority depends on impact | Compare blocked work with the same issue when a spare device is available. | Priority should reflect the stated impact. | Included in the live suite. |
| Invalid model output | Missing fields or a department that does not exist. | Reject the result and create no request. | Covered by simulated provider tests. |
| Provider failure | Quota exhaustion or an unavailable provider. | Keep the draft and report the failure. | Covered by simulated provider tests. |

Run from the repository root after setup, with a valid Gemini key in backend/.env:

```sh
npm run eval:ai
```

The command builds the backend and exercises its real review and submission logic. It uses an in-memory department catalog and a persistence spy, so no employee request is saved. The live cases require network access and use the account's Gemini quota. The selected model is read from GEMINI_MODEL. No paid-provider fallback is used; the controller's deterministic fallback is part of the local application logic.

Assertions check department, concerns, priority and whether persistence is allowed. They do not require identical generated prose. The two impact cases compare blocked work with work continuing on a spare device. This is a small semantic rubric, not proof that all wording or factual accuracy is correct.

Results, model, timestamp, durations and observed candidates are saved to [week4-ai-eval-results.json](week4-ai-eval-results.json). A failed case produces a nonzero exit code. Missing credentials stop the run instead of claiming success. Provider or quota failures count as failures in live semantic cases. Reruns can produce different outputs.

## Files involved

| File | Purpose |
| --- | --- |
| `backend/src/ai.controller.ts` | Validates drafts and AI results, then decides whether submission can proceed. |
| `backend/src/gemini-review.ts` | Calls Gemini and handles its response. |
| `backend/src/local-review.ts` | Runs the optional offline checks. |
| `backend/src/app.service.ts` | Saves requests and enforces staff permissions and status changes. |
| `frontend/src/App.jsx` | Handles the request form and submission. |
| `frontend/src/AiReview.jsx` | Shows the provider explanation, feedback, and corrections. |
| `backend/src/ai.controller.spec.ts` | Tests provider behavior and failure handling. |
| `backend/test/requests.e2e-spec.ts` | Tests the backend with a real test database. |
| `e2e/service-request.spec.js` | Tests the employee flow in a browser. |

## Delivery status

The AI-assisted intake feature is implemented in the same repository, the backend validates its results, and department staff keep control of the work. The README explains how to configure and run it.

The repository now includes the executable eight-case suite, `npm run eval:ai`, and a machine-readable result report. Check that report for the latest outcome; a failing live run must be investigated rather than described as a pass. README includes the evaluation command.

This is still a teaching project. Employee selection uses a demo identity header rather than production authentication. We do not claim production rate limiting, monitoring, or protection against duplicate submissions after an uncertain network failure. AI can also misunderstand a request; department review remains necessary.


Latest verified evaluation: **8/8 passed** on 2026-09-23T17:57:52.095Z, using gemini-3.5-flash-lite. Six cases used live Gemini and two injected failures. All 66 deterministic tests and the frontend/backend builds also passed during this verification.


A later live run passed 5/8: three provider calls reached the 30-second timeout. That report is preserved in [the timeout report](week4-ai-eval-timeout-results.json). The provider timeout is now 60 seconds and timeout failures return HTTP 504. See the latest result JSON for current results; earlier passing runs do not guarantee every live run passes.

Latest verified rerun (2026-09-23T17:57:52.095Z): **8/8 passed**. All six live semantic cases and both injected boundary cases passed.
