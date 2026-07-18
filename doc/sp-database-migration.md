# SP専用DBへの移行

実運用前は[`production-test-checklist.md`](production-test-checklist.md)を使用して、
app DB非変更、同期、認証、障害復旧、並行運用を確認する。

## 方針

- `yojitsu-db` は既存appの正本として維持する。
- SPは専用の `yojitsu-sp-db` だけへ書き込む。
- `SOURCE_DB` から `DB` への同期は一方向で、同期処理はapp DBへ書き込まない。
- app由来カードへのSP変更は `application_overrides`、学生へのSP変更は
  `student_overrides` に保存する。このため再同期してもSPの詳細状態は失われない。
- appで削除された行はSPで即時物理削除せず、`source_deleted_at`を設定する。

## Cloudflare設定

SP専用DBは2026-07-18にAPACリージョンへ作成済みで、`wrangler.toml`の `DB.database_id` に反映済みです。再作成が必要な場合だけ次を実行します。

```bash
npx wrangler d1 create yojitsu-sp-db
```

表示されたUUIDを`packages/backend/wrangler.toml`の`DB.database_id`へ設定する。
`SOURCE_DB.database_id`は既存app DBのまま変更しない。

続いてSP DBだけへmigrationを適用する。

```bash
npx wrangler d1 migrations apply yojitsu-sp-db --remote
```

本番Secretとして`JWT_SECRET`を設定し、許可するPages URLを`ALLOWED_ORIGIN`へ設定する。

## 同期

WorkerのcronはJST 09:00と21:00に実行される。教員JWTで
`POST /api/admin/sync?admin_id=<教員ID>`を呼ぶと手動同期もできる。

同期データは最初にステージングテーブルへ全件読み込まれる。読み込みが完了した場合だけ、
D1のトランザクションバッチで本テーブルへ一括反映する。途中失敗時は表示中のSPデータを
変更しない。30分以内の同期は排他制御され、重複実行されない。

同期対象は`students`、`applications`、`teachers`。メールテンプレートはSP側で
独立して編集するため、自動同期しない。

直近20回の結果は、教員JWTで
`GET /api/admin/sync/status?admin_id=<教員ID>`を呼んで確認できる。
`SYNC_ALERT_WEBHOOK`を設定すると、同期失敗時にJSONの通知を送信する。

## セキュリティ

- 学生と教員は8時間有効のJWTを使用する。
- 学生は自分のカードだけを参照・更新できる。
- ログイン失敗は15分間に5回までとする。
- `ALLOWED_ORIGIN`未設定時はlocalhost以外からのCORSアクセスを拒否する。
- app由来の学生はSPから削除できない。
- 教員が初回ログインに成功すると、app互換のハッシュからSP専用PBKDF2認証情報へ自動移行する。
  app DBの教員情報は変更しない。

### CSP

フロントエンドのビルド時に`dist/_headers`を自動生成し、Cloudflare Pagesから固定CSPを返す。
別ソフトや日常作業は不要。`connect-src`にはビルド時の`VITE_API_URL`のオリジンだけを設定する。
本番CIは`VITE_API_URL`未設定時にビルドを失敗させる。

JavaScriptは同一オリジンだけを許可し、iframe、object、base URL書換え、未許可API通信を拒否する。
既存のReactインラインスタイルを維持するため、`style-src`だけ`unsafe-inline`を許可する。
API URLや外部配信元を追加した場合に限り、CSP生成処理を更新する。

## バックアップと復旧

SP DB作成後、migrationや大きなデータ変更の前に現在のブックマークを記録する。

```bash
npx wrangler d1 time-travel info yojitsu-sp-db
```

障害時はまずSPのデプロイを止め、同期履歴と対象時刻を確認する。復元はDBを上書きするため、
時刻と対象がSP DBであることを二重確認してから実行する。

```bash
npx wrangler d1 time-travel restore yojitsu-sp-db --timestamp="2026-07-18T00:00:00+09:00"
```

復元後は手動同期を実行し、SPオーバーライドが必要な時点まで戻っていることを確認する。

## 切替

来年度の切替前にappを読み取り専用にし、最終同期を実行する。確認後、
`SOURCE_DB`とcronを削除してSP DBを唯一の正本にする。
