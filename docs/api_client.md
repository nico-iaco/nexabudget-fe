# API Client Layer

This document details the network communication layer of the NexaBudget Frontend application, including HTTP configuration, authentication interceptors, and a full catalog of API endpoints.

---

## 🛠️ Axios Client Configuration

All backend communication flows through a single Axios instance defined in `src/services/api.ts`.

```typescript
const apiClient = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});
```

* **Base URL**: Set to `/api`. In local development, the Vite dev server acts as a proxy (see `vite.config.ts`), forwarding requests to the address specified in the environment (`VITE_BE_BASE_URL`, defaults to `http://localhost:8080`). A second proxy entry forwards `/mcp` to the same target for the backend's stateless MCP server.
* **Production Routing**: In Docker/production environments, Nginx handles requests targeting `/api` (and `/mcp`) and proxies them to the backend directly.
* **One module, one responsibility**: every endpoint is exposed as a thin typed function in `api.ts`, returning the raw `AxiosResponse`. Components and hooks never build URLs themselves; response payloads are typed against the interfaces in `src/types/api.ts`.

Callers generally do not invoke these functions directly for shared entities — they go through the React Query hooks in `src/hooks/` (see [Architecture](architecture.md)).

---

## 🛡️ Interceptors

The Axios client implements two global interceptors to automate token management and session lifecycle handling:

### 1. Request Interceptor (Bearer JWT Injection)

Before any HTTP request is dispatched, the request interceptor executes:

* Checks `localStorage` for the key `authToken`.
* If present, appends the HTTP header: `Authorization: Bearer <token>`.
* **Form Data / Multipart Exception**: For endpoints handling file uploads (CSV or OFX bank statement imports), the interceptor detects if the request payload is an instance of `FormData`. If so, it removes the `'Content-Type'` header, permitting the browser to automatically compute and set the correct multipart boundary.

### 2. Response Interceptor (Automatic 403 Session Invalidation)

The response interceptor processes responses and errors globally:

* If a request fails with an HTTP `403 Forbidden` status code, the client infers that the JWT token has expired or been revoked.
* **Exception**: Auth endpoints (login and register calls) are ignored to prevent recursive redirect loops during credential submission errors.
* **Logout Handler**: The interceptor flushes storage by deleting `authToken` and `auth` from `localStorage`, then forces a browser redirect to the login screen:
    `window.location.href = '/login';`
* **Note**: only `403` triggers this flow. A `401 Unauthorized` response is passed through to the caller unchanged, so callers should still handle rejected promises themselves.

---

## 🗂️ API Endpoints Catalog

The application exposes the following endpoint bindings in `api.ts`, organized by service area.

### 1. Authentication & Profile

* `POST /auth/login` — Initiates user login (`login`).
* `POST /auth/register` — Creates a new user profile (`register`).
* `PUT /users/` — Updates user profile preferences like preferred currency (`updateUserProfile`).

### 2. Accounts Management

* `GET /accounts/` — Fetches all user financial accounts (`getAccounts`).
* `GET /accounts/total-balance/preferred` — Fetches the summed balance converted to the user's preferred currency (`getTotalPreferredBalance`).
* `POST /accounts` — Creates a new financial account (`createAccount`).
* `PUT /accounts/:id` — Edits account settings (`updateAccount`).
* `DELETE /accounts/:id` — Soft-deletes an account (`deleteAccount`).

### 3. Transactions & Transfers

* `GET /transactions` — Fetches all transactions (`getTransactionsByUserId`).
* `GET /transactions/account/:accountId` — Fetches all transactions for a specific account (`getTransactionsByAccountId`).
* `GET /transactions/account/:accountId/paged` — Paginated and filtered account transaction list (`getTransactionsByAccountIdPaged`).
* `GET /transactions/paged` — Paginated and filtered global transaction list (`getTransactionsPaged`).
* `GET /transactions/daterange` — Fetches transactions between two dates (`getTransactionsBetweenDates`).
* `GET /transactions/period-totals` — Retrieves income/expense sums for a date range (`getPeriodTotals`).
* `POST /transactions` — Logs a single transaction (`createTransaction`).
* `PUT /transactions/:id` — Updates a transaction (`updateTransaction`).
* `DELETE /transactions/:id` — Soft-deletes a transaction (`deleteTransaction`).
* `POST /transactions/transfer` — Logs a transfer between two accounts (`createTransfer`).
* `POST /transactions/convert-to-transfer` — Links two existing transactions as a transfer pair (`linkTransactionsAsTransfer`).
* `POST /transactions/convert-single-to-transfer` — Converts a single transaction into a transfer by creating a complementary record (`convertSingleToTransfer`).

Both paged endpoints share the query-string builder `buildTransactionParams`, which serializes `page`, `size`, and the optional `TransactionFilters` fields: `type` (`IN`/`OUT`), `categoryId`, `startDate`, `endDate`, `search`, `sortBy` (`date`/`amount`/`description`/`type`), and `sortDir` (`ASC`/`DESC`).

### 4. Statement File Imports

* `POST /accounts/:accountId/import/csv/preview` — Generates parsing preview for uploaded CSV files using custom column mappings (`previewCsvImport`).
* `POST /accounts/:accountId/import/csv` — Commits CSV transactions into the database (`confirmCsvImport`).
* `POST /accounts/:accountId/import/ofx/preview` — Previews OFX statement imports (`previewOfxImport`).
* `POST /accounts/:accountId/import/ofx` — Commits OFX transactions into the database (`confirmOfxImport`).

These four endpoints send `FormData`, which is why the request interceptor drops the JSON `Content-Type` header.

### 5. Trash & Soft Delete

* `GET /trash/transactions` — Lists soft-deleted transactions (`getDeletedTransactions`).
* `GET /trash/accounts` — Lists soft-deleted accounts (`getDeletedAccounts`).
* `POST /trash/transactions/:id/restore` — Restores a soft-deleted transaction (`restoreTransaction`).
* `POST /trash/accounts/:id/restore` — Restores a soft-deleted account (`restoreAccount`).

### 6. Reports & Analytics

* `GET /reports/monthly-trend` — Fetches net cashflow historical trends (`getMonthlyTrend`, `months` defaults to 12).
* `GET /reports/category-breakdown` — Category spending aggregates for a date range (`getCategoryBreakdown`).
* `GET /reports/month-comparison` — Month-over-month comparative analysis (`getMonthComparison`).
* `GET /reports/monthly-projection` — Current month run-rate projection (`getMonthlyProjection`).
* `GET /reports/balance-trend` — Net worth closing balance trend lines (`getBalanceTrend`).
* `POST /reports/ai-analysis` — Dispatches a financial audit job to the AI agent (`requestAiAnalysis`).
* `GET /reports/ai-analysis/:jobId` — Checks AI report completion status (`getAiAnalysisStatus`).
* `GET /reports/ai-analysis/:jobId/download` — Downloads AI report as PDF binary (`downloadAiAnalysis`).

### 7. Budget Templates & Alerts

* `GET /budget-templates` — Lists active budgets (`getBudgetTemplates`).
* `GET /budget-templates/:id` — Gets detailed budget constraints (`getBudgetTemplate`).
* `POST /budget-templates` — Creates a budget limit (`createBudgetTemplate`).
* `PUT /budget-templates/:id` — Updates budget parameters (`updateBudgetTemplate`).
* `DELETE /budget-templates/:id` — Deletes a budget template (`deleteBudgetTemplate`).
* `GET /budgets/monthly-summary` — Calculates spent vs remaining monthly stats, optionally for a given `date` (`getBudgetMonthlySummary`).
* `GET /budget-alerts` — Lists alerts configured on budget thresholds, optionally filtered by `budgetId` (`getBudgetAlerts`).
* `POST /budget-alerts` — Creates a new budget trigger threshold (`createBudgetAlert`).
* `PUT /budget-alerts/:id` — Edits threshold limits (`updateBudgetAlert`).
* `DELETE /budget-alerts/:id` — Removes a budget threshold alert (`deleteBudgetAlert`).

### 8. API Keys Administration

* `GET /api-keys` — Lists API tokens issued for programmatic actions (`getApiKeys`).
* `POST /api-keys` — Requests a new API token (`createApiKey`).
* `PUT /api-keys/:id` — Toggles or modifies key permissions (`updateApiKey`).
* `DELETE /api-keys/:id` — Revokes an API token (`deleteApiKey`).

### 9. System Auditing

* `GET /audit-log` — Paginated logs mapping all user creation/update/deletion actions (`getAuditLog`).
* `GET /audit-log/:entityType/:entityId` — Filters audit trails for a specific target (`getAuditLogForEntity`).

### 10. Categories Management

* `GET /categories` — Fetches active categories (`getCategories`).
* `POST /categories` — Creates a custom category (`createCategory`).
* `PUT /categories/:id` — Edits category name (`updateCategory`).
* `DELETE /categories/:id` — Removes category (`deleteCategory`).
* `POST /categories/:sourceId/merge-into/:targetId` — Merges all transactions from a source category into a target category, deleting the source (`mergeCategoryInto`).

### 11. Open Banking (multi-provider)

Bank linking is served by a **single provider-agnostic API** under `/banking/{provider}`, where `provider` is the slug `gocardless` or `enable-banking`. Every function below takes that slug as its first argument; `api.providerSlug(account.provider)` derives it from an account's stored provider (defaulting to `gocardless`).

* `GET /banking/:provider/banks?countryCode=XX` — Lists supported institutions for a country (`getBankList`).
* `POST /banking/:provider/link` — Requests a consent redirect URL for an institution (`getBankLink`).
* `POST /banking/:provider/:localAccountId/session` — Exchanges an authorization `code` for a linked session and returns the discovered bank accounts (`completeBankSession`, used by the Enable Banking callback).
* `GET /banking/:provider/:localAccountId/accounts` — Lists the bank sub-accounts available for linking (`getBankAccounts`).
* `POST /banking/:provider/:localAccountId/link` — Confirms which bank sub-account maps to the local account (`linkBankAccount`).
* `POST /banking/:provider/:localAccountId/sync` — Triggers a transaction sync, optionally reconciling against an `actualBalance` (`syncBankAccount`).

One legacy GoCardless-only endpoint is retained because the unified API does not expose its richer link state (`linkedStatus` / pending link / reason):

* `GET /gocardless/bank/:localAccountId/account` — GoCardless link status and sub-accounts (`getGoCardlessBankAccounts`).

### 12. Crypto Integrations

* `GET /crypto/portfolio?currency=…` — Retrieves aggregated asset counts and real-time values (`getPortfolioValue`).
* `POST /crypto/holdings` — Creates manual token holdings (`addManualHolding`).
* `PATCH /crypto/holdings/:id` — Modifies manual holding amount (`updateManualHolding`).
* `DELETE /crypto/holdings/:id` — Deletes a manual holding (`deleteManualHolding`).
* `POST /crypto/binance/keys` — Saves Binance API credentials (`saveBinanceKeys`).
* `POST /crypto/binance/sync` — Initiates Binance holdings fetch (`syncFromBinance`).
* `POST /crypto/coinbase/keys` — Saves Coinbase API credentials (`saveCoinbaseKeys`).
* `POST /crypto/coinbase/sync` — Initiates Coinbase holdings fetch (`syncFromCoinbase`).

### 13. AI Auto-Categorization Job

* `POST /transactions/categorize-uncategorized` — Dispatches auto-categorize job (`startCategorizationJob`).
* `GET /transactions/categorize-uncategorized/:jobId` — Queries progress on categorizer execution (`getCategorizationJobStatus`).

### 14. Conversational Financial Assistant (Chat)

* `POST /chat` — Dispatches message to AI agent and fetches reply (`sendChatMessage`).
* `GET /chat/sessions` — Lists active chat discussions (`getChatSessions`).
* `GET /chat/sessions/:sessionId/messages` — Retrieves chat history (`getChatSessionMessages`).
* `DELETE /chat/sessions/:sessionId` — Closes and deletes a session (`deleteChatSession`).
