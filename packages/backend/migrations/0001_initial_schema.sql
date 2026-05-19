-- Initial Schema Migration

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_birthday TEXT,
  parent_email TEXT,
  is_completed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  job_title TEXT,
  hojin_number TEXT,
  status TEXT DEFAULT '予定',
  current_step TEXT DEFAULT '未着手',
  steps_json TEXT,
  memo TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mail_templates (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed Default Mail Templates
INSERT OR REPLACE INTO mail_templates (key, value) VALUES 
('tplStudentSubject', '【就活状況確認】{date}時点の進捗状況'),
('tplStudentBody', '{name} さん

現在の就職活動の進捗状況を更新してください。

■ 現在の状況
選考中・予定企業数: {active_count}社
内定獲得企業数: {offer_count}社

【選考中の企業一覧】
{active_list}

【内定獲得企業一覧】
{offer_list}

システムにログインし、最新のステータスに更新をお願いします。'),
('tplParent0Subject', '【重要・学校より】ご子女の就職活動状況に関するご相談'),
('tplParent0Body', '{name} 様

学校より、ご子女の就職活動状況についてご連絡いたします。
現在、受験予定の企業が0社となっており、次の選考予定が入っていない状況です。

学校でも個別の求人紹介や面談でのサポートを進めておりますが、次のステップに向けてご家庭でも就活の状況や将来の希望についてお話しいただき、見守りとサポートをお願いいたします。'),
('tplParent1Subject', '【学校より】ご子女の就職活動状況についてのご案内'),
('tplParent1Body', '{name} 様

学校より、ご子女の就職活動状況についてご連絡いたします。
現在、選考中または受験予定の企業が {active_count} 社となっております。

選考中の企業が少なくなっており、結果次第で活動が一時的に止まってしまうリスクがございます。並行してエントリー数をあと1〜2社程度増やすよう、ご家庭からもアドバイスいただけますと幸いです。'),
('tplParent3Subject', '【学校より】ご子女の就職活動状況についてのご報告'),
('tplParent3Body', '{name} 様

学校より、ご子女の就職活動状況についてご連絡いたします。
現在、選考中または受験予定の企業が {active_count} 社あり、積極的に就職活動に取り組まれております。

この時期は面接の緊張や日々の疲れが出やすいタイミングです。ご家庭におかれましては、温かい見守りと体調面の気遣い・サポートをお願いいたします。');
