// 機能の有効・無効。
//
// 生成AIを使う機能(返信アシスト・特別連絡の文面作成・AI黒服「クロ」・占い/相性診断・予定のAI読み取り)は
// 現在「蓋閉じ」中。画面から導線を外し、外部のAIサービスへの送信も行わない。
// 再開するときはビルド時の環境変数 VITE_ENABLE_AI=true を設定する
// (GitHub の Variables に VITE_ENABLE_AI=true を追加して再配備)。コードは残してある。
export const AI_ENABLED = import.meta.env.VITE_ENABLE_AI === 'true'
