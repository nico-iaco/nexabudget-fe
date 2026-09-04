# Audit Frontend — nexabudget-fe

Data audit: 2026-07-02
Ambito: analisi statica del repository, nessuna modifica al codice.

Legenda: **Priorità** Alta/Media/Bassa · **Sforzo** S (< 1 giorno) / M (2-4 giorni) / L (> 1 settimana)

Nota preliminare: il progetto è più maturo di quanto suggerisca `CLAUDE.md`. Sono già presenti: budget con alert (`src/pages/budgets`), integrazione GoCardless, crypto (Binance/Coinbase + holding manuali), un modulo AI/chat (`src/pages/chat`), audit log, cestino (trash/soft-delete), merge categorie, import transazioni da CSV, e **React Query** come cache dei dati server — quest'ultimo non documentato in `CLAUDE.md`, che va aggiornato.

---

## 1. Design System e Coerenza Visiva

### 1.1 Token di spaziatura/tipografia esistono ma sono quasi inutilizzati
**Priorità: Alta · Sforzo: M**

`src/theme/tokens.ts` definisce `SPACING` (xs-xl) e colori semantici (`COLOR_POSITIVE/NEGATIVE/ACCENT/WARNING`), applicati via `ConfigProvider` in `App.tsx:139-146` (solo `colorPrimary` + `borderRadius: 8`, nessun token di font o di scala dimensionale).

- `SPACING.*` è usato solo **13 volte** in tutto il progetto.
- Sono stati contati **92 `fontSize:` inline** e **168 `margin*/padding*` inline** con valori arbitrari (12, 11, 13, 20, '16px 20px'...) sparsi in ~20 file, invece di riusare la scala esistente.
- `borderRadius` è hardcoded con valori diversi (2, 4, 6, 8, 20, 100) in almeno 12 file.
- `boxShadow` è duplicato manualmente in 11 punti; due stringhe sono **copiate identiche** tra `LoginPage.tsx:48`/`RegisterPage.tsx:45` e tra `TrendDualChart.tsx:252`/`BalanceTrendChart.tsx:229`.
- `DashboardPage.tsx:113` hardcoda `'#faad14'` invece di importare `COLOR_WARNING`, già importato nello stesso file.

**Raccomandazione**: estendere `theme/tokens.ts` con una scala tipografica e di radius, poi sostituire progressivamente i valori inline nei componenti a maggior traffico (Dashboard, Transactions, Reports).

### 1.2 Colori hardcoded nei grafici bypassano il theming dark/light
**Priorità: Alta · Sforzo: M**

`DashboardCharts.tsx`, `TrendDualChart.tsx`, `DashboardChartsMobile.tsx`, `BalanceTrendChart.tsx` usano branching manuale tipo `isDark ? '#fff' : '#000'` invece di `theme.useToken()` (`token.colorText`, `token.colorBgContainer`), pattern già corretto in `ChatPage.tsx` e `DatePresetPicker.tsx`. `src/index.css`/`App.css` conservano inoltre la palette residua del template Vite (`#242424`, `#646cff`...), scollegata dal tema dell'app.

### 1.3 Pattern duplicati per lo stesso tipo di elemento
**Priorità: Media-Alta · Sforzo: M**

- **Stat card**: 3 implementazioni diverse per lo stesso concetto (metrica in una Card) — `DashboardPage.tsx:230-286` (Card piena + Statistic + Sparkline), `BalanceTrendSection.tsx:220-246` (`Card size="small"`), `PortfolioSummary.tsx:139-152` (`Card bordered={false}`). Nessun componente `StatCard` condiviso.
- **Empty state**: esiste `src/components/EmptyState.tsx` (con CTA), usato solo in 5 punti; altri **15+ punti** (grafici, tabelle) usano `<Empty>` nudo di AntD — due "look" diversi per lo stesso stato vuoto.
- **Conferma azioni distruttive**: `src/hooks/useConfirm.ts` è la convenzione documentata ("usare per modali distruttive"), ma `TransactionsPage.tsx:400` chiama `Modal.confirm(...)` direttamente, duplicando la logica invece di riusare l'hook.
- **Modali**: split su 3 convenzioni di cartella — `src/components/modals/*`, `src/components/*Modal.tsx` (3 file), `src/pages/**/​*Modal.tsx` (3 file). Nessuna regola chiara su dove va un nuovo modale.

### 1.4 Struttura cartelle e naming
**Priorità: Media · Sforzo: S**

Naming dei file è coerente (PascalCase, suffissi `*Page`/`*Modal`/`*Card`/`*Drawer`/`*Chart` rispettati quasi ovunque; unica eccezione: `PortfolioSummary.tsx` che si comporta come una Card ma non segue il suffisso). La struttura di `components/` mescola però organizzazione per tipo (`modals/`) e per feature (`dashboard/`, `reports/`, `onboarding/`, `layout/`), con un bucket flat di componenti condivisi alla radice e nessuna cartella `common/`/`ui/` per i primitivi generici (`EmptyState`, `PageHeader`, `SafeSelect`, `DatePresetPicker`).

**Raccomandazione**: scegliere una sola convenzione per i modali e introdurre `components/common/`.

---

## 2. Usabilità

### 2.1 Errori API silenziosamente ingoiati su Dashboard e Transazioni
**Priorità: Alta · Sforzo: S**

- `src/hooks/useDashboardData.ts:71-72` — ogni chiamata passa da un wrapper `safe()` che fa `.catch(() => fallback)` senza log né notifica utente. Un errore backend reale (500, rete) diventa **indistinguibile** da "nessun dato" sulla pagina più visitata dell'app.
- `TransactionsPage.tsx:347` — `fetchTransactions().catch(console.error)`, unico punto nel codebase senza `message.error` a fronte di un fetch fallito sulla lista transazioni.
- Contrasto: 7+ altre pagine (Budgets, Crypto, Audit, Categorie...) gestiscono correttamente errori con `message.error`, e `BalanceTrendSection.tsx` è l'esempio di riferimento (loading + errore + empty gestiti bene).
- Esiste già un componente pensato per standardizzare questo (`src/components/AsyncBoundary.tsx`, con convenzione documentata nel suo stesso commento) ma **non è usato da nessuna parte** — codice morto che avrebbe risolto esattamente questo problema.

**Raccomandazione**: adottare `AsyncBoundary` (o quantomeno `message.error`) su `useDashboardData` e `TransactionsPage`.

### 2.2 Tabella Transazioni senza scroll orizzontale su viewport intermedi
**Priorità: Media · Sforzo: S**

Tutte le `<Table>` dell'app impostano `scroll={{x: 'max-content'}}` tranne le due tabelle di `TransactionsPage.tsx` (righe 688, 713; 7 colonne, `tableLayout="fixed"`). Il passaggio alla vista mobile a `<List>` scatta solo sotto ~768px (`isSmallMobile`): tablet/laptop piccoli (769-991px) restano con una tabella a 7 colonne fissa e senza modo di scrollare le colonne tagliate.

### 2.3 Nessuna empty state personalizzata sulla pagina Transazioni
**Priorità: Media · Sforzo: S**

`TransactionsPage.tsx` non usa mai `EmptyState`: un conto nuovo senza transazioni mostra il placeholder generico di AntD, senza CTA per aggiungere la prima transazione — incoerente col resto dell'app.

### 2.4 Accessibilità: focus ring disabilitato su un componente riusato
**Priorità: Media · Sforzo: S**

`src/components/DatePresetPicker.tsx:248` imposta `outline: 'none'` come stile inline sui chip di preset data, usato sia in Dashboard che in Reports. Essendo inline, vince sulla regola globale `:focus-visible` di `mobile.css:398-403` — un utente da tastiera perde ogni indicatore di focus su questo componente in due pagine chiave.

Inoltre ~5-6 bottoni icon-only senza `aria-label` in `ApiKeysCard.tsx`, `CategoriesCard.tsx`, `BudgetAlertsDrawer.tsx` (edit/delete), mentre lo stesso pattern è etichettato correttamente altrove — omissione isolata, facile da sistemare.

### 2.5 Gestione errori isLoading/isError di account e categorie ignorata a livello Layout
**Priorità: Bassa · Sforzo: S**

`useAccounts`/`useCategories` espongono `isError` da React Query, ma `Layout.tsx:52-53` non lo consuma mai. Un fetch fallito di account/categorie (che alimentano sidebar, form transazioni, dashboard) fallisce silenziosamente in tutta l'app, senza banner né retry.

---

## 3. Architettura e Stato

### 3.1 Le transazioni non passano da React Query: invalidazioni cache "morte"
**Priorità: Alta · Sforzo: M**

`queryKeys.transactions()` esiste ed è invalidato dopo un trasferimento (`useAccountActions.ts:87`) e dopo una sync GoCardless (`useAccountSync.ts:54`), ma `TransactionsPage.tsx` **non usa `useQuery`** per le transazioni: fa fetch imperativo (`fetchTransactions`, righe ~334-349) in `useState` locale, aggiornato via `useEffect`. Le invalidazioni sono quindi **no-op**: dopo un trasferimento o una sync bancaria, la tabella transazioni resta stale finché l'utente non cambia manualmente un filtro o pagina.

**Raccomandazione**: migrare `TransactionsPage` a `useQuery`/`useInfiniteQuery` per beneficiare di cache e invalidazione reale.

### 3.2 `transactionRefreshKey` è morto ma ancora cablato nelle query key della dashboard
**Priorità: Alta · Sforzo: S**

`Layout.tsx:39` — `const [transactionRefreshKey] = useState(0)`: il setter non è mai usato (confermato via grep), il valore resta sempre `0`. È comunque passato a `useDashboardData` e usato come parte delle query key della dashboard (`queryKeys.dashboard`, `DashboardPage.tsx:89`). **Nessun `invalidateQueries` nel codebase invalida mai queste chiavi**: la dashboard si aggiorna solo per `staleTime` (2 min) o refocus finestra dopo qualunque CRUD su transazioni. `outletContext.ts:12-14` marca esplicitamente il valore come `@deprecated ... mantenuto per retrocompatibilità durante la migrazione` — è debito di una migrazione mai completata.

**Raccomandazione**: rimuovere `transactionRefreshKey` e sostituirlo con `invalidateQueries` esplicite sulle query key della dashboard dopo ogni mutazione di transazioni.

### 3.3 Interceptor Axios gestisce solo 403, non 401
**Priorità: Media · Sforzo: S**

`src/services/api.ts:84-95` fa auto-logout solo su HTTP 403. Se il backend usa la semantica standard 401 per token scaduto/non valido (comune con Spring Security), l'app non farà mai redirect a `/login` — l'utente resta bloccato su richieste che falliscono silenziosamente. Da verificare contro il comportamento reale del backend e, se necessario, aggiungere gestione 401.

### 3.4 Fetch account duplicato fuori dalla cache condivisa
**Priorità: Bassa · Sforzo: S**

`GoCardlessCallbackPage.tsx:47` chiama `api.getAccounts()` direttamente invece di passare per `useAccounts()`, bypassando la cache React Query condivisa (`queryKeys.accounts`) — possibile disallineamento temporaneo dei dati mostrati.

### 3.5 CLAUDE.md non riflette lo stato attuale dell'architettura
**Priorità: Bassa · Sforzo: S**

La sezione "State & Data Flow" di `CLAUDE.md` non menziona React Query, che è ora il meccanismo dominante per account/categorie/dashboard/mutazioni. Da aggiornare per evitare che futuri contributor (umani o AI) partano da un modello mentale sbagliato.

### 3.6 Nota positiva
`Layout.tsx` **non** è più un god-component: la logica è già stata estratta in hook dedicati (`useAccounts`, `useCategories`, `useAccountActions`, `useAccountSync`, `useGoCardlessLink`, `useConfirm`), e il prop-drilling residuo è di un solo livello (via `Outlet context` o props dirette), gestibile.

---

## 4. Feature Mancanti / Migliorie

Elenco calibrato su ciò che il progetto **non ha ancora**, escludendo funzionalità già presenti (budget+alert, GoCardless, crypto Binance/Coinbase, import transazioni, audit log, cestino, merge categorie, chat AI).

### 4.1 Export dati (CSV/PDF) di transazioni e report
**Priorità: Alta · Sforzo: S**
Nessun endpoint/azione di export trovato nel codebase, nonostante esista già l'import CSV (`TransactionImportModal.tsx`) — l'asimmetria è evidente. Per un'app di finanza personale è un requisito quasi table-stakes (dichiarazione dei redditi, condivisione con commercialista, backup). Sforzo basso perché i dati sono già strutturati e filtrabili (`TableFilters` in `TransactionsPage.tsx`).

### 4.2 Transazioni ricorrenti (automatiche)
**Priorità: Alta · Sforzo: M**
Nessuna traccia di "recurring/ricorrenze" nel codice (solo menzionato in i18n, non implementato). Bollette, abbonamenti, stipendio sono il caso d'uso più comune per un'app di budgeting: senza ricorrenze automatiche l'utente deve reinserire manualmente ogni mese le stesse voci, aumentando l'attrito e il rischio di dati mancanti (che a sua volta falsa i report/budget già costruiti).

### 4.3 Notifiche push per gli alert di budget
**Priorità: Alta · Sforzo: M**
Esiste già un sistema di budget alert (`BudgetAlertsDrawer.tsx`) ma nessuna integrazione con Web Push/notifiche del service worker (il progetto ha già `vite-plugin-pwa`, quindi l'infrastruttura PWA è pronta). Gli alert attualmente sono visibili solo se l'utente apre l'app: per essere utili (evitare sforamenti di budget) devono raggiungere l'utente proattivamente.

### 4.4 Obiettivi di risparmio (savings goals)
**Priorità: Media · Sforzo: M**
Nessuna entità "goal/obiettivo" trovata in `types/api.ts` né nelle pagine. È una feature ad alto impatto percepito per app di finanza personale (es. "risparmia 3000€ per le vacanze entro dicembre"), e si integrerebbe naturalmente con i conti/portfolio già modellati.

### 4.5 Ricerca full-text e filtri salvati sulle transazioni
**Priorità: Media · Sforzo: S**
`TransactionsPage.tsx` ha già filtri per tipo/categoria/data ma nessuna ricerca testuale libera (es. su descrizione/note) né la possibilità di salvare una combinazione di filtri ricorrente (es. "spese ristoranti ultimo trimestre"). Con l'aumentare dello storico transazioni (specialmente via sync GoCardless) diventa rapidamente necessario.

### 4.6 Multi-valuta end-to-end (conversione e visualizzazione consolidata)
**Priorità: Media · Sforzo: L**
Il modello dati ha già campi `currency`/`originalCurrency`/`defaultCurrency` in `types/api.ts`, ma non è chiaro (da verificare lato UI/backend) se dashboard e report convertano correttamente importi multi-valuta in un totale consolidato nella valuta preferita dell'utente. Se il backend supporta più conti in valute diverse, questa è la feature che sblocca l'uso reale di quel dato già modellato.

### 4.7 Reminder scadenze bollette/pagamenti
**Priorità: Bassa · Sforzo: M**
Complementare a 4.2 (ricorrenze): un calendario/reminder di scadenze imminenti (es. "bolletta luce tra 3 giorni") aumenterebbe la funzione dell'app oltre il puro tracking storico, spostandola verso pianificazione proattiva — dipende però da 4.2 come prerequisito dati.

### 4.8 "Financial health score" / riepilogo insight sulla dashboard
**Priorità: Bassa · Sforzo: M**
Il progetto ha già un `AiAnalysisCard` e un modulo chat AI: un punteggio sintetico o insight automatici ricorrenti (es. "le tue spese ristoranti sono +30% rispetto al mese scorso") sarebbe un'estensione naturale di infrastruttura già esistente (AI + report aggregati) piuttosto che una feature ex novo, quindi a basso rischio/costo incrementale ma alto valore percepito.

---

## Riepilogo priorità

| # | Item | Sezione | Priorità | Sforzo |
|---|------|---------|----------|--------|
| 1 | Errori silenziosi su Dashboard/Transazioni | Usabilità | Alta | S |
| 2 | `transactionRefreshKey` morto, dashboard stale | Architettura | Alta | S |
| 3 | Transazioni fuori da React Query, invalidazioni no-op | Architettura | Alta | M |
| 4 | Token spacing/tipografia quasi inutilizzati | Design | Alta | M |
| 5 | Colori hardcoded nei grafici (dark/light) | Design | Alta | M |
| 6 | Export CSV/PDF transazioni e report | Feature | Alta | S |
| 7 | Transazioni ricorrenti | Feature | Alta | M |
| 8 | Notifiche push per budget alert | Feature | Alta | M |
| 9 | Pattern duplicati (stat card, empty state, confirm) | Design | Media-Alta | M |
| 10 | Interceptor Axios: solo 403, non 401 | Architettura | Media | S |
| 11 | Tabella transazioni senza scroll su tablet | Usabilità | Media | S |
| 12 | Empty state mancante su Transazioni | Usabilità | Media | S |
| 13 | Focus ring disabilitato in `DatePresetPicker` | Usabilità | Media | S |
| 14 | Struttura cartelle modali/common | Design | Media | S |
| 15 | Savings goals | Feature | Media | M |
| 16 | Ricerca full-text / filtri salvati transazioni | Feature | Media | S |
| 17 | Multi-valuta end-to-end | Feature | Media | L |
| 18 | Fetch account duplicato fuori cache | Architettura | Bassa | S |
| 19 | CLAUDE.md non aggiornato (React Query) | Architettura | Bassa | S |
| 20 | isError account/categorie ignorato in Layout | Usabilità | Bassa | S |
| 21 | Reminder scadenze | Feature | Bassa | M |
| 22 | Financial health score / insight AI | Feature | Bassa | M |
