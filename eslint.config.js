import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

// キャバ帳 ESLint（flat config）。型チェックは tsc に任せ、ここではバグに直結するルールに絞る。
export default tseslint.config(
  { ignores: ['dist/**', 'dist-cast/**', 'dist-store/**', 'dev-dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // v7の React Compiler 系ルール(set-state-in-effect等)は既存の
      // 「編集画面でフォーム初期化するeffect」に大量ヒットするため、古典2ルールに絞る
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // tsconfig(noUnusedLocals) と重複するため、_始まりは許容してESLint側は緩める
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Firestoreのデータ境界などで any を使う箇所があるため error にしない
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
