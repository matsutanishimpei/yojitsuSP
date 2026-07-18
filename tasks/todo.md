# Yojitsu SP 残作業

最終更新: 2026-07-18

## 本番投入前（未完了）

- [ ] `doc/state-machine.md` の確定仕様に合わせて状態管理を実装する
- [ ] 既存ステップ結果の移行と状態変更履歴migrationを追加する
- [ ] 状態遷移・例外・再同期保持のテストを追加する
- [x] Cloudflare D1の不要DBを管理者判断で整理する
- [x] `yojitsu-sp-db` を新規作成する（2026-07-18、APAC）
- [x] `packages/backend/wrangler.toml` の安全用ダミーIDをSP DBの実IDへ置き換える
- [x] SP DBだけに全migrationを適用する
- [ ] Worker SecretsとGitHub Secrets/Variablesを設定する
- [x] 初回同期を実行し、appとSPの件数を照合する（2026-07-18: 学生11、応募100、教員4）
- [x] Time Travelの復旧可能bookmarkを確認する（2026-07-18）
- [ ] `doc/production-test-checklist.md` を実環境で完了する
- [ ] 合格後にGitHub Variable `SP_DEPLOY_ENABLED=true` を設定する

## 個人情報（優先対応）

- [x] `doc/dump.sql` の必要性を判断し、初回同期後に作業ツリーから削除する
- [x] `doc/dump.sql` と旧画面画像を全commitから除去し、識別情報を匿名化する
- [x] 整理したmainを `--force-with-lease` でGitHubへ反映する
- [x] 旧commitに紐づくGitHub Actions実行とログを削除する
- [ ] SHA直接指定で残る旧commitをGitHub側でパージする
- [x] 未使用の `doc/images/` を作業ツリーから削除し、履歴削除対象にする
- [ ] リポジトリの公開範囲と過去の共有先を確認する

## コード側で完了済み

- [x] app DBとSP DBのbinding分離
- [x] appからSPへの一方向・1日2回同期
- [x] ステージング、排他、失敗履歴、オーバーライド保持
- [x] 学生・教員JWTと本人確認
- [x] ログイン試行制限と教員PBKDF2資格情報
- [x] CORS、CSP、主要セキュリティヘッダー
- [x] 型検査、単体テスト、D1結合テスト、CSP検査、ビルドの一括確認
- [x] CIのデプロイ停止ゲート

## app廃止前

- [ ] app側の更新停止日時を決め、利用者へ告知する
- [ ] 最終同期と差分照合を実施する
- [ ] SP DBのバックアップ・復旧試験を実施する
- [ ] `SOURCE_DB`と定期同期を削除する変更をレビューする
- [ ] SPを唯一の原本にする運用手順を承認する
