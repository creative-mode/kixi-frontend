# Playwright E2E

Run `npm run test:e2e` at the repository root. Without `E2E_BASE_URL`, Playwright
starts the Docker Compose stack with the mock backend, waits for the gateway health
endpoint, then tears the stack down. Docker Compose and the Chromium browser are
required locally; install the browser with `npx playwright install chromium`.

To point the suite at a separately managed environment, set `E2E_BASE_URL`,
`E2E_ADMIN_USERNAME`, `E2E_TEACHER_USERNAME`, and `E2E_PASSWORD`. The test data uses
unique account, school, and class names. An external environment must allow account
registration, OCR import, review/publication, and room creation for those credentials.

CI runs against the mock on pull requests to `DEV` and pushes to `QUA`. The HTML report
is uploaded as a workflow artifact even when a journey fails.
