# Yojitsu SP 現行仕様

最終更新: 2026-07-18

## 1. 目的

Yojitsu SPは、学生の応募企業、選考段階、結果、メモ、就活完了状態を、学生本人と教員が管理するシステムです。

既存の `yojitsu-app` は移行期間中の原本です。SPはappを参照専用の同期元として利用し、SP独自の更新はSP専用DBに保存します。来年度にappを廃止するまでは、この一方向構成を維持します。

## 2. システム境界

| 要素 | 役割 | 書き込み主体 |
|---|---|---|
| app D1 (`yojitsu-db`) | 移行元の原本 | 既存appのみ |
| SP D1 (`yojitsu-sp-db`) | SPの表示・編集・認証・同期履歴 | SPのみ |
| Cloudflare Workers | API、認証、同期、外部API連携 | SP D1のみ |
| Cloudflare Pages | React画面、CSP・セキュリティヘッダー | なし |

SPの `SOURCE_DB` 型は `SELECT` 文だけを受け付けます。app DBへの更新経路は設けません。

## 3. 利用者と権限

### 学生

- 学籍番号と保護者誕生日4桁でログインします。
- 自分のカードだけを参照・追加・更新できます。
- 他学生のデータへのアクセスは403になります。

### 教員

- 教員IDとパスワードでログインします。
- 学生一覧、企業マトリクス、メール、テンプレート、同期状態を管理できます。
- 初回の正常ログイン時に、app互換パスワードをSP専用PBKDF2資格情報へ移行します。app側は変更しません。

ログイン成功時に8時間有効なJWTを発行します。保護APIには `Authorization: Bearer <token>` が必要です。ログイン失敗はIDと接続元単位で記録し、15分以内に5回失敗すると一時制限します。

## 4. 主な機能

- 学生用カンバン: 選考中、内定、終了の3列表示
- 応募カード: 企業名、職種、法人番号、状態、選考履歴、メモ
- 選考結果に応じた状態の自動導出
- gBizINFOによる企業検索（未設定時はモック応答）
- 教員用学生一覧と企業マトリクス
- 学生CSV一括登録
- 保護者メール・完了状態のSP独自更新
- メールテンプレート編集とGAS経由の送信
- appからSPへの手動・定期同期、同期履歴表示

カードは学生1人につき最大30件です。入力上限は共有Zodスキーマで検査します。

カード状態、選考ステップ状態、遷移、自動提案、例外処理の確定仕様は[選考状態・ステップ状態仕様](state-machine.md)を正本とします。状態仕様の実装が完了するまでは、同文書の「現在実装との差分」を必ず参照してください。

## 5. データモデル

### app由来の同期表

- `students`: 学生の原本コピー。`source_managed`、`source_deleted_at`、`synced_at`を保持
- `applications`: 応募の原本コピー。`source_deleted_at`、`synced_at`を保持
- `teachers`: 教員の原本コピー

### SP独自表

- `application_overrides`: app由来カードへのSP独自変更
- `student_overrides`: 保護者メール・完了状態のSP独自変更
- `mail_templates`: メールテンプレート
- `sp_teacher_credentials`: PBKDF2化した教員資格情報
- `login_attempts`: ログイン失敗の制限用記録
- `sync_runs`: 同期結果・件数・エラー
- `sync_lock`: 同期の二重実行防止
- `source_*_stage`: 同期公開前のステージング表

SPで新規作成するカードは負のIDを使用し、app由来の正のIDと衝突しません。画面表示では原本値よりオーバーライド値を優先します。

## 6. 同期仕様

- 定期実行: 毎日09:00、21:00 JST
- 方向: `SOURCE_DB`（app）から `DB`（SP）のみ
- 対象: `students`、`applications`、`teachers`
- 非対象: メールテンプレート、オーバーライド、SP資格情報
- 排他: 同期ロックを取得し、重複実行を409で拒否
- 公開: 全件をステージングへ読み込めた後、D1バッチで本表へ反映
- 失敗: 現在の表示データを維持し、`sync_runs`へエラーを保存
- 削除: appで見えなくなった行は物理削除せず `source_deleted_at` を設定

通知先 `SYNC_ALERT_WEBHOOK` が設定されていれば、同期失敗をJSONで通知します。

## 7. セキュリティ

- CORSは本番の `ALLOWED_ORIGIN` と完全一致するオリジンだけを許可
- JWT署名鍵はCloudflare Secretで管理
- CSPはビルド時に `VITE_API_URL` から生成
- スクリプトは同一オリジンだけ、API通信は指定APIオリジンだけを許可
- `frame-ancestors 'none'`、`object-src 'none'`、`X-Content-Type-Options: nosniff`
- 本番ビルドはAPI URLがなければ失敗
- DBアクセスはプリペアドステートメントを使用

秘密情報、SQLダンプ、個人情報をGitへ追加しません。

## 8. 外部連携

- gBizINFO API: 企業名と法人番号の検索
- GAS Webhook: メール送信。未設定時は送信せずWorkerログへのモック出力
- 任意Webhook: 同期失敗通知

## 9. 非機能・品質確認

`npm run check` で型検査、単体テスト、ローカルD1結合テスト、CSP検査、全ビルドを実行します。CIではPull Requestとmainへのpushで確認します。

実データ、Cloudflare権限、メール到達性、端末差異、復旧操作は自動テストだけでは保証できません。[実運用テストチェックリスト](production-test-checklist.md)の完了を本番判定条件とします。

## 10. app廃止時の変更

最終同期と照合後に、`SOURCE_DB` bindingとcronを削除します。SP DBを唯一の原本へ切り替える変更は、バックアップ取得、復旧確認、運用承認後に別リリースとして実施します。

APIの詳細は[API仕様](api.md)、DB作業は[DB移行・運用手順](sp-database-migration.md)を参照してください。
