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

The draft stays in the form if a review fails. The app does not create a request or switch to another provider automatically.

| Situation | Result |
| --- | --- |
| Unknown employee | 401; no provider call. |
| Invalid input | 400; the employee must correct the form. |
| AI asks for clarification | 400 with review feedback; no request is created. |
| Missing Gemini key | 503 with a setup message. |
| Gemini quota is exhausted | 503 with a message to try later. |
| Provider error, timeout, blocked response, or invalid output | 502; the draft is kept. |

Gemini calls have a 30-second timeout and a 2,200-token output limit. The application does not expose the API key or raw provider errors to the employee.

## Tests already in place

The last full verification passed **63 tests**: 20 unit tests, 38 API/database tests, and 5 browser tests. The frontend and backend builds also passed after the lifecycle was changed back to Submitted. This document-only rewrite did not rerun them.

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

## AI evaluation plan

The assignment asks for five to eight representative AI evaluation cases and one repeatable command. We have defined the following eight cases. **They are a plan at this stage; a dedicated evaluation runner has not been added yet.**

| Case | Example | What we expect | Evidence so far |
| --- | --- | --- | --- |
| Clear IT request | Laptop will not start and work is blocked. | IT, High priority, no unnecessary clarification. | Live review passed. |
| Clear HR request | Employee asks how to submit annual leave next month. | HR, with no invented dates or urgency. | Still needs a model evaluation. |
| Too little information | “Help” / “It is broken.” | Ask what is broken and what help is needed. | Local rules are tested; Gemini evaluation still needed. |
| Contradictory request | Laptop title, but description says it works and asks about expenses. | Flag the contradiction and suggest Finance. | Live review flagged both issues. |
| Trusted department context | Payroll question sent to IT. | Suggest an existing Finance department; never invent one. | Output validation is tested; semantic case still needed. |
| Priority depends on impact | Compare blocked work with the same issue when a spare device is available. | Priority should reflect the stated impact. | Still needs a model evaluation. |
| Invalid model output | Missing fields or a department that does not exist. | Reject the result and create no request. | Covered by simulated provider tests. |
| Provider failure | Quota exhaustion or an unavailable provider. | Keep the draft and report the failure. | Covered by simulated provider tests. |

The future runner should check these outcomes rather than expecting identical wording every time. It should record the model, date, case, result, and pass/fail outcome, and exit with a failure code when a case fails. All examples should use fictional information.

There is currently no `npm run eval:ai` command. `npm run check` runs deterministic tests; it is not a substitute for the assignment's AI evaluation command.

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

## What remains before the Week 4 submission

The AI-assisted intake feature is implemented in the same repository, the backend validates its results, and department staff keep control of the work. The README explains how to configure and run it.

The remaining assignment work is to turn the eight evaluation cases into an executable suite, provide one repeatable evaluation command, run it, and record the results. The README should then include that command.

This is still a teaching project. Employee selection uses a demo identity header rather than production authentication. We do not claim production rate limiting, monitoring, or protection against duplicate submissions after an uncertain network failure. AI can also misunderstand a request; department review remains necessary.
