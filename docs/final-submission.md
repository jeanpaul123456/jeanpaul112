# Final capstone submission

The professor's slides require the same public repository and a reachable remote app. The four addresses are **email recipients**, not four separate project links.

Deadline: **Wednesday, September 30, 2026, 12:00 PM Beirut time**. Submit early enough to verify access. The submitted commit is frozen; later pushes do not count unless requested. Keep the live app reachable through the defense.

## Project details

| Field | Information |
|---|---|
| Project | Internal Operations Service Hub |
| Repository | https://github.com/jeanpaul123456/jeanpaul112 |
| Stack | React, NestJS, Prisma; SQLite locally, libSQL configured for hosting |
| AI | Gemini 3.1 Flash-Lite reviews clarity, consistency, department and priority |
| Workflow | Submitted → Accepted → In Progress → Completed; staff can reject active requests with a reason |
| Verification | September 26 release gate passed: both builds, 71 deterministic tests and 8 AI evaluation cases |
| Verified live app | https://jeanpaul112.onrender.com/app/ |
| Observed deployed commit | `9572674c3872634ec2c4f529eab551cb395a20b5` during the September 28 recovery drill |
| Final submission status | Live journey, restart persistence and controlled provider failure/recovery passed; use the final deployed documentation commit SHA when sending |

AI is advisory. The backend validates its output, and department staff control acceptance and completion. Provider failure keeps the draft unsent. The public app uses demo identities and fictional data.

The confirmed student name is Jean-Paul Chouaifaty. The final SHA must match the deployed version after these evidence updates. Read it from `/health` and confirm it matches `git rev-parse HEAD` before sending. The recovery drill tested the application code at the SHA above; subsequent evidence edits do not change application code.

## Email draft

Send to all four:

- fouad.b@euriskomobility.com
- toni.tannoury@eurisko.net
- fawzi.c@euriskomobility.com
- academy@eurisko.net

Subject: `AI Academy 2026 - Final Capstone Submission - Jean-Paul Chouaifaty`

Your name and verified live URL are filled in. Complete the final commit SHA after release sign-off before sending:

```text
Hello,

Please find my Internal Operations Service Hub final capstone submission.

Full Name: Jean-Paul Chouaifaty
Repository URL: https://github.com/jeanpaul123456/jeanpaul112
Final Commit SHA: [full SHA from git rev-parse HEAD, matching the deployment]
Live App URL: https://jeanpaul112.onrender.com/app/
Demo Access / Roles: Open the app and use the Demo employee selector.
Charbel Chouaifaty submits requests. Jean-Paul Chouaifaty handles IT,
Elie Massoud handles HR, and Maria Boutros handles Finance.
No password is required for this fictional-data teaching demo.

The README contains the user journey, setup, tests, AI evaluations,
release checks and links to the Week 1–5 evidence.

Suggested demo: select Charbel, submit a clear IT request, then select
Jean-Paul to accept, start and complete it. Return to Charbel to view
the completion notification and saved history.

Thank you,
Jean-Paul Chouaifaty
```

## Evidence links

- [README and onboarding](../README.md)
- [AI implementation and evaluation](week4-production-ai.md)
- [Automated release gate result](release-gate-results.json)
- [Deployment, monitoring and recovery](week5-release-operations.md)

These files are saved locally. Their updated GitHub versions become available after the changes are committed and pushed. They supplement the required public app; they do not replace it.

## Save, push and freeze the release

In VS Code, open this existing project folder and inspect Source Control. Confirm that `.env`, databases, dependencies and generated outputs are not staged. Then, from its terminal:

```sh
git status
git diff
git add .gitignore README.md docs backend/src backend/prisma backend/test backend/package.json backend/package-lock.json backend/.env.example package.json package-lock.json frontend/package.json frontend/package-lock.json scripts render.yaml
git diff --cached --stat
git commit -m "Prepare final capstone release and operations handoff"
git push origin master
git rev-parse HEAD
```

Inspect the staged diff before committing, especially for secrets. Run the release gate, deploy this exact commit and complete the remote checks in [Week 5](week5-release-operations.md). If source changes afterward, test and deploy the new commit and update the submitted SHA. Do not send this draft with pending fields or a NO-GO release.

## Fifteen-minute defense

Show the live intake and staff workflow first. Explain the data model and why only the receiving department can process the request. Show an invalid or unauthorized action, AI clarification, and why AI cannot accept or complete work. Then show tests, evaluations, the release identity, health/logs, and actual failure/recovery evidence. Be ready to explain each file and the remaining limitations in your own words.
