# Yojitsu SP

専門学校の就職活動状況を、学生と教員が管理するWebアプリケーションです。

既存の `yojitsu-app` は原本データの提供元として維持し、Yojitsu SPは専用DBで詳細な状態を管理します。SPからappのDBへ書き込む処理はありません。

## 現在の構成

```text
yojitsu-app D1（原本・参照専用）
          │ 09:00 / 21:00 JSTに同期
          ▼
Yojitsu SP D1（SPだけが更新）
          ▲
          │ API
React / Cloudflare Pages ── Cloudflare Workers
```

- フロントエンド: React、Vite、TypeScript
- API: Hono、Cloudflare Workers
- DB: Cloudflare D1（app用とSP用を分離）
- 認証: 学生・教員JWT（有効期間8時間）
- 品質確認: TypeScript、Vitest、ローカルD1結合テスト、CSP検査、ビルド

## データ保護の原則

- `SOURCE_DB` は既存appのD1で、同期処理からは `SELECT` だけを許可します。
- `DB` はSP専用の `yojitsu-sp-db` です。
- app由来データへのSP独自変更はオーバーライド表に保存し、再同期後も維持します。
- appで削除されたデータはSPで即時削除せず、削除日時を記録します。
- SPからappへデータを戻す機能は実装しません。

詳細は[DB移行・運用手順](doc/sp-database-migration.md)を参照してください。

## 開発

Node.js 22以上を使用します。

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

ローカルのバックエンド設定は `packages/backend/.dev.vars.example` を参考に、`packages/backend/.dev.vars` を作成してください。秘密情報はGitへ登録しません。

全確認は次の1コマンドです。

```bash
npm run check
```

このコマンドは型検査、単体テスト、D1結合テスト、CSP検査、バックエンド・フロントエンドのビルドを実行します。

## D1マイグレーション

必ずSP専用DBにだけ適用します。`yojitsu-db` はappの原本なので、SP作業でマイグレーションを適用してはいけません。

```bash
# ローカル
npx wrangler d1 migrations apply yojitsu-sp-db --local --config packages/backend/wrangler.toml

# 本番SP DB
npx wrangler d1 migrations apply yojitsu-sp-db --remote --config packages/backend/wrangler.toml
```

本番準備と初回同期は[DB移行・運用手順](doc/sp-database-migration.md)、GitHub Actionsの設定は[リモートデプロイ設定ガイド](リモートデプロイ設定ガイド.md)に従ってください。

## ドキュメント

- [ドキュメント一覧](doc/README.md)
- [現行仕様](doc/specification.md)
- [API仕様](doc/api.md)
- [選考状態・ステップ状態仕様](doc/state-machine.md)
- [DB移行・同期・復旧](doc/sp-database-migration.md)
- [実運用テストチェックリスト](doc/production-test-checklist.md)
- [リモートデプロイ設定ガイド](リモートデプロイ設定ガイド.md)

## 本番化の現在地

コード上の品質確認、本番SP用D1の作成、migration適用、初回同期と件数照合まで完了しています。秘密情報設定と実運用テストが完了するまでデプロイを有効にしないでください。

## 個人情報

学生情報は個人情報です。ログ、SQLダンプ、画面キャプチャを外部公開しないでください。実名・学籍番号を含んでいた `doc/dump.sql` は作業ツリーから削除済みですが、過去にリモートへpush済みの場合はGit履歴削除の要否を確認してください。

## License

[MIT License](LICENSE.md)
