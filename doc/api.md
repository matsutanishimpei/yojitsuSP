# Yojitsu SP API仕様

最終更新: 2026-07-18

ベースパスは `/api` です。JSONを使用し、認証が必要なAPIには次のヘッダーを付けます。

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

JWTの有効期間は8時間です。学生JWTは本人のデータだけ、教員JWTは管理APIを利用できます。管理APIの `admin_id` は移行互換用に残っている必須パラメーターで、実際の権限判定はJWTで行います。

## 認証・疎通

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/hello` | 不要 | API疎通確認 |
| POST | `/login` | 不要 | 学生ログイン |
| POST | `/admin/login` | 不要 | 教員ログイン |

学生ログイン:

```json
{ "student_id": "00ZZ0000", "parent_birthday": "0309" }
```

教員ログイン:

```json
{ "id": "teacher-id", "password": "password" }
```

成功時は `success`、`token`、`role`、`id`、`name` を返します。15分以内に5回失敗したID・接続元は429になります。

## 学生・カード

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/search?name=企業名` | 学生/教員 | 企業検索 |
| GET | `/cards?student_id=ID` | 学生/教員 | カード一覧 |
| POST | `/cards` | 学生/教員 | カード追加 |
| PATCH | `/cards/:id` | 学生/教員 | カード更新 |

カード追加:

```json
{ "student_id": "00ZZ0000", "company_name": "株式会社例", "hojin_number": "1234567890123" }
```

カード更新では `status`、`job_title`、`steps_json`、`memo` の一部または全部を送ります。`status` は `予定`、`選考中`、`内定`、`終了` のいずれかです。`steps_json` は最大100件の選考履歴をJSON文字列で渡します。

学生JWTで他学生のIDを指定すると403です。カードがなければ404、学生が未登録または30件上限なら400です。

## 教員管理

以下は教員JWTと `?admin_id=<教員ID>` が必要です。

| Method | Path | 概要 |
|---|---|---|
| GET | `/admin/students` | 学生一覧と応募集計 |
| GET | `/admin/matrix` | 企業×学生の応募一覧 |
| POST | `/admin/students/bulk` | CSV一括登録 |
| PATCH | `/admin/students/:id` | 完了状態・保護者メール更新 |
| DELETE | `/admin/students/:id` | SP独自学生の削除 |
| GET | `/admin/templates` | メールテンプレート取得 |
| POST | `/admin/templates` | メールテンプレート保存 |
| POST | `/admin/send-email` | GAS経由のメール送信 |
| POST | `/admin/sync` | appからSPへ手動同期 |
| GET | `/admin/sync/status` | 直近20件の同期履歴 |
| GET | `/admin/teachers` | 教職員一覧 |
| POST | `/admin/teachers` | SP教職員を追加 |
| PATCH | `/admin/teachers/:id` | 有効・無効状態を変更 |
| DELETE | `/admin/teachers/:id` | 教職員を無効化（物理削除しない） |

app由来学生の削除は409です。CSVは1MBまで、メール件名は200文字、本文は100,000文字までです。

教職員追加では共通`admin`系IDを拒否し、12文字以上の初期パスワードを要求します。ログイン中の本人と最後の有効教員は無効化できません。

## 主なステータスコード

| Code | 意味 |
|---|---|
| 200 | 成功 |
| 400 | 入力不正・業務上限 |
| 401 | 未認証・ログイン失敗・期限切れJWT |
| 403 | 本人または役割の権限不足 |
| 404 | 対象なし |
| 409 | 同期中・app由来データ削除不可 |
| 429 | ログイン試行制限 |
| 500 | サーバーまたは外部連携エラー |

エラーは原則として次の形です。

```json
{ "success": false, "error": { "message": "説明", "code": "任意のコード" } }
```

## 運用上の注意

- `/admin/sync` は大量読込を伴うため、連打しません。
- `GAS_EMAIL_URL` 未設定時のメールAPIは `mocked: true` を返し、実送信しません。
- gBizINFOキー未設定時の企業検索は開発用の代替結果になる場合があります。
- API変更時は、この文書、共有Zodスキーマ、フロントエンド、テストを同じ変更で更新します。
