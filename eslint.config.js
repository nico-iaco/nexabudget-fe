import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      // `reactHooks.configs['recommended-latest']` è la variante eslintrc (dichiara
      // `plugins` come array di stringhe), rifiutata da ESLint 10 che ha rimosso il
      // supporto eslintrc. La stessa preset in formato flat config vive sotto
      // `configs.flat`.
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      // Convenzione del progetto: prefisso `_` per argomenti tenuti solo per
      // compatibilità di firma (es. `fetchAccounts(_background?)`).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // --- Regole introdotte da eslint-plugin-react-hooks 7 (React Compiler) ---
      // Tenute attive come warning, non come errore: segnalano pattern legittimi
      // per questo codebase e il loro fix è un refactor, non una correzione locale.
      //
      // set-state-in-effect: colpisce il pattern "fetch imperativo al mount"
      // (`useEffect(() => { fetchX() }, [])`) presente in 14 file. La soluzione
      // reale è migrare quelle viste a React Query — già tracciato in CLAUDE.md
      // come known gap — non aggiungere soppressioni riga per riga.
      'react-hooks/set-state-in-effect': 'warn',
      // purity: l'analisi statica non distingue il corpo di un event handler dal
      // render, quindi segnala `Date.now()` dentro `handleSend` (ChatPage) che a
      // runtime non viene mai eseguito durante il render.
      'react-hooks/purity': 'warn',
      // preserve-manual-memoization: bailout del compiler su una useMemo corretta
      // (PortfolioSummary), non un difetto del codice.
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
])
