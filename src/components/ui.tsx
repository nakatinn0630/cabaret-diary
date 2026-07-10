import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/* ============================================================================
   キャバ帳 共通UIキット（クロードデザインのビジュアル体系を実装へ移植）
   - グラスモーフィズム / 明朝見出し / night(#1f1147)・gold(#c9a24b)・rose(#e6789b)
   - 表示専用プリミティブ。データ取得は各ページの Firestore フックが担う。
   ========================================================================== */

/* --- カラートークン（Tailwindユーティリティ文字列） --- */
export const subTx = 'text-[#6f6588] dark:text-[#b9b0cf]'
export const goldTx = 'text-[#8a6a1e] dark:text-[#e3c987]'
export const glass =
  'rounded-2xl border backdrop-blur-md bg-white/75 border-night/10 shadow-sm dark:bg-white/[0.06] dark:border-white/10'
export const inputCls =
  'w-full rounded-xl border px-4 py-3 text-[15px] bg-white/70 dark:bg-white/[0.07] border-night/10 dark:border-white/15 outline-none focus:border-gold placeholder:text-night/30 dark:placeholder:text-white/30'

/* --- カード --- */
export function Card({
  className = '',
  children,
  onClick,
  label,
}: {
  className?: string
  children: ReactNode
  onClick?: () => void
  label?: string
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`${glass} text-left w-full active:scale-[0.99] transition ${className}`}
      >
        {children}
      </button>
    )
  }
  return (
    <div aria-label={label} className={`${glass} ${className}`}>
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className={`text-[11px] font-bold tracking-[0.18em] ${subTx}`}>{children}</h2>
}

export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`text-[11px] px-2.5 py-1 rounded-full border ${className}`}>{children}</span>
}

/* --- セグメント選択（単一選択・列挙値のタップUI） --- */
type SegOption<T extends string> = T | { v: T; label: ReactNode }
export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => {
        const v = (typeof o === 'object' ? o.v : o) as T
        const label = typeof o === 'object' ? o.label : o
        const on = v === value
        return (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={`px-4 py-2.5 rounded-full text-[13px] font-semibold border transition min-h-[44px] ${
              on
                ? 'bg-gold text-night border-gold shadow'
                : 'bg-white/50 dark:bg-white/[0.06] border-night/10 dark:border-white/15'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

/* --- 複数選択ピル --- */
export function MultiPill<T extends string>({
  options,
  values,
  onToggle,
}: {
  options: { v: T; label: ReactNode }[]
  values: T[]
  onToggle: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = values.includes(o.v)
        return (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.v)}
            className={`px-4 py-2.5 rounded-full text-[13px] font-semibold border transition min-h-[44px] ${
              on
                ? 'bg-rose text-white border-rose shadow'
                : 'bg-white/50 dark:bg-white/[0.06] border-night/10 dark:border-white/15'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`w-[52px] h-8 rounded-full p-1 transition flex-shrink-0 ${
        on ? 'bg-gold' : 'bg-night/20 dark:bg-white/15'
      }`}
    >
      <span
        className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : ''
        }`}
      ></span>
    </button>
  )
}

export function Field({
  label,
  required,
  error,
  children,
}: {
  label: ReactNode
  required?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className={`text-[12px] font-semibold ${subTx}`}>
        {label}
        {required && <span className="text-rose ml-1">*必須</span>}
      </span>
      {children}
      {error && <span className="block text-[12px] text-red-400 font-semibold">{error}</span>}
    </label>
  )
}

/* --- 画面ヘッダー（safe-area対応・戻る） --- */
export function Header({
  title,
  back,
  onBack,
  right,
  className = '',
}: {
  title: ReactNode
  back?: boolean
  onBack?: () => void
  right?: ReactNode
  className?: string
}) {
  return (
    <header
      className={`sticky top-0 z-20 flex items-center gap-2 px-5 pb-3 flex-shrink-0 backdrop-blur-md bg-white/70 dark:bg-night/60 border-b border-night/5 dark:border-white/10 ${className}`}
      style={{ paddingTop: 'max(env(safe-area-inset-top), 52px)' }}
    >
      {back && (
        <button
          type="button"
          onClick={onBack}
          className="text-gold text-[15px] font-semibold py-1 pr-2 -ml-1"
        >
          ‹ 戻る
        </button>
      )}
      <h1 className="font-serif text-[19px] font-bold tracking-wider flex-1 truncate">{title}</h1>
      {right}
    </header>
  )
}

export function Main({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <main className={`flex-1 min-h-0 overflow-y-auto px-5 pb-28 space-y-3.5 ${className}`}>
      {children}
    </main>
  )
}

export function StickyBar({
  onSave,
  onCancel,
  saveLabel = '保存',
  disabled,
}: {
  onSave: () => void
  onCancel: () => void
  saveLabel?: string
  disabled?: boolean
}) {
  return (
    <div className="safe-bottom sticky bottom-0 inset-x-0 px-4 pt-3 pb-3 backdrop-blur-lg bg-white/70 dark:bg-night/70 border-t border-night/10 dark:border-white/10 flex gap-3 z-20">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 min-h-[48px] rounded-2xl border border-night/15 dark:border-white/20 font-semibold text-[14px]"
      >
        キャンセル
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="flex-[2] min-h-[48px] rounded-2xl bg-gold text-night font-bold text-[15px] shadow-lg shadow-gold/30 disabled:opacity-40"
      >
        {saveLabel}
      </button>
    </div>
  )
}

export function Avatar({ name, size = 44 }: { name?: string; size?: number }) {
  return (
    <div
      aria-hidden="true"
      className="rounded-full flex items-center justify-center font-serif font-bold text-night bg-gradient-to-br from-[#e8c97e] to-gold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(name || '?').charAt(0)}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className={`text-[13px] text-center py-6 ${subTx}`}>{children}</p>
}

/* ============================================================================
   トースト（保存/更新の完了フィードバック）
   ========================================================================== */
const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toast = useCallback((m: string) => {
    setMsg(m)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 2200)
  }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {msg && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[100] px-5 py-3 rounded-full text-[13px] font-bold bg-night text-white dark:bg-gold dark:text-night shadow-xl anim-toast"
        >
          {msg}
        </div>
      )}
    </ToastCtx.Provider>
  )
}
