# API Client Layer

This document details the network communication layer of the NexaBudget Frontend application, including HTTP configurations, authentication interceptors, and a full catalog of API endpoints.

---

## 🛠️ Axios Client Configuration

All backend communication flows through a single Axios instance defined in [src/services/api.ts](file:///Users/nicolaiacovelli/WebstormProjects/nexabudget-fe/src/services/api.ts).

```typescript
const apiClient = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});
```

* **Base URL**: Set to `/api`. In local development, the Vite dev server acts as a proxy (see `vite.config.ts`), forwarding requests to the address specified in the environment (`VITE_BE_BASE_URL`, defaults to `http://localhost:8080`).
* **Production Routing**: In Docker/production environments, Nginx handles requests targeting `/api` and proxies them to the backend API container directly.

---

## 🛡️ Interceptors

The Axios client implements two global interceptors to automate token management and session lifecycle handling:

### 1. Request Interceptor (Bearer JWT Iniection)

Before any HTTP request is dispatched, the request interceptor executes:

* Checks `localStorage` for the key `authToken`.
* If present, appends the HTTP header: `Authorization: Bearer <token>`.
* **Form Data / Multipart Exception**: For endpoints handling file uploads (CSV or OFX bank statement imports), the interceptor detects if the request payload is an instance of `FormData`. If so, it deletes the `'Content-Type'` header, permitting the browser to automatically compute and set the correct multi-part boundaries.

### 2. Response Interceptor (Automatic 403 Session Invalidation)

The response interceptor processes responses and errors globally:

* If a request fails with an HTTP `403 Forbidden` status code, the client infers that the JWT token has expired or been revoked.
* **Exception**: Auth endpoints (login and register calls) are ignored to prevent recursive redirect loops during credential submission errors.
* **Logout Handler**: The interceptor flushes storage by deleting `auth_token` and `auth` from `localStorage`, then forces a browser redirect to the login screen:
    `window.location.href = '/login';`

---

## 🗂️ API Endpoints Catalog

The application exposes the following endpoint bindings in `api.ts`, organized by service area:

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

### 4. Statement File Imports

* `POST /accounts/:accountId/import/csv/preview` — Generates parsing preview for uploaded CSV files using custom mappings (`previewCsvImport`).
* `POST /accounts/:accountId/import/csv` — Commits CSV transactions into the database (`confirmCsvImport`).
* `POST /accounts/:accountId/import/ofx/preview` — Previews OFX statement imports (`previewOfxImport`).
* `POST /accounts/:accountId/import/ofx` — Commits OFX transactions into the database (`confirmOfxImport`).

### 5. Trash & Soft Delete

* `GET /trash/transactions` — Lists soft-deleted transactions (`getDeletedTransactions`).
* `GET /trash/accounts` — Lists soft-deleted accounts (`getDeletedAccounts`).
* `POST /trash/transactions/:id/restore` — Restores a soft-deleted transaction (`restoreTransaction`).
* `POST /trash/accounts/:id/restore` — Restores a soft-deleted account (`restoreAccount`).

### 6. Reports & Analytics

* `GET /reports/monthly-trend` — Fetches net cashflow historical trends (`getMonthlyTrend`).
* `GET /reports/category-breakdown` — Category spending aggregates for a date range (`getCategoryBreakdown`).
* `GET /reports/month-comparison` — Month-over-month comparative analysis (`getMonthComparison`).
* `GET /reports/monthly-projection` — Current month run-rate projection (`getMonthlyProjection`).
* `GET /reports/balance-trend` — Net worth closing balance trend lines (`getBalanceTrend`).
* `POST /reports/ai-analysis` — Dispatches a monthly financial audit job to the AI agent (`requestAiAnalysis`).
* `GET /reports/ai-analysis/:jobId` — Checks AI report completion status (`getAiAnalysisStatus`).
* `GET /reports/ai-analysis/:jobId/download` — Downloads AI report as PDF binary (`downloadAiAnalysis`).

### 7. Budget Templates & Alerts

* `GET /budget-templates` — Lists active budgets (`getBudgetTemplates`).
* `GET /budget-templates/:id` — Gets detailed budget constraints (`getBudgetTemplate`).
* `POST /budget-templates` — Creates a budget limit (`createBudgetTemplate`).
* `PUT /budget-templates/:id` — Updates budget parameters (`updateBudgetTemplate`).
* `DELETE /budget-templates/:id` — Deletes a budget template (`deleteBudgetTemplate`).
* `GET /budgets/monthly-summary` — Calculates spent vs remaining monthly stats (`getBudgetMonthlySummary`).
* `GET /budget-alerts` — Lists alerts configured on budget thresholds (`getBudgetAlerts`).
* `POST /budget-alerts` — Creates a new budget trigger threshold (`createBudgetAlert`).
* `PUT /budget-alerts/:id` — Edits threshold limits (`updateBudgetAlert`).
* `DELETE /budget-alerts/:id` — Removes a budget threshold alert (`deleteBudgetAlert`).

### 8. API Keys Administration

* `GET /api-keys` — Lists API tokens issued for programmatic actions (`getApiKeys`).
* `POST /api-keys` — Requests a new API token (`createApiKey`).
* `PUT /api-keys/:id` — Toggles or modifies key permissions (`updateApiKey`).
* `DELETE /api-keys/:id` — Revokes an API token (`deleteApiKey`).

### 9. System Auditing

* `GET /audit-log` — Paginated database logs mapping all user creation/update/deletion actions (`getAuditLog`).
* `GET /audit-log/:entityType/:entityId` — Filters audit trails for a specific target (`getAuditLogForEntity`).

### 10. Categories Management

* `GET /categories` — Fetches active categories (`getCategories`).
* `POST /categories` — Creates a custom category (`createCategory`).
* `PUT /categories/:id` — Edits category name (`updateCategory`).
* `DELETE /categories/:id` — Removes category (`deleteCategory`).
* `POST /categories/:sourceId/merge-into/:targetId` — Merges all transactions from a source category into a target category, deleting the source (`mergeCategoryInto`).

### 11. GoCardless Open Banking

* `GET /gocardless/bank` — Lists available banks in a country (`getGoCardlessBankList`).
* `POST /gocardless/bank/link` — Initiates GoCardless bank link flow (`getGoCardlessBankLink`).
* `GET /gocardless/bank/:localAccountId/account` — Lists bank sub-accounts (`getGoCardlessBankAccounts`).
* `POST /gocardless/bank/:localAccountId/link` — Confirms sub-account links (`linkGoCardlessBankAccount`).
* `POST /gocardless/bank/:localAccountId/sync` — Triggers Open Banking sync for an account (`syncGoCardlessBankAccount`).

### 12. Crypto Integrations

* `GET /crypto/portfolio` — Retrieves aggregated asset counts and real-time values (`getPortfolioValue`).
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
