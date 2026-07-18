import { z } from 'zod';

// Login Validation Schema
export const loginSchema = z.object({
  student_id: z.string().min(1, '学籍番号は必須です').max(64),
  parent_birthday: z.string().regex(/^\d{4}$/, '誕生日は4桁の数字で入力してください (例: 0309)'),
});

export const adminLoginSchema = z.object({
  id: z.string().min(1, '教員IDは必須です').max(64),
  password: z.string().min(1, 'パスワードは必須です').max(256),
});

export const createTeacherSchema = z.object({
  id: z.string().trim().min(3, '教員IDは3文字以上で入力してください').max(64)
    .regex(/^[A-Za-z0-9._-]+$/, '教員IDは半角英数字と . _ - だけを使用してください')
    .refine((id) => !['admin', 'administrator', 'root'].includes(id.toLowerCase()), '共通管理者IDは使用できません'),
  name: z.string().trim().min(1, '氏名は必須です').max(100),
  temporary_password: z.string().min(12, '初期パスワードは12文字以上にしてください').max(256),
});

export const updateTeacherAccessSchema = z.object({
  is_active: z.boolean(),
});

// Selection Step Schema
export const applicationStepSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付は YYYY-MM-DD 形式にしてください'),
  name: z.string().min(1, '選考段階名は必須です').max(64),
  result: z.enum(['', '合格', '不合格', '辞退']),
});

// Card Creation Schema
export const createCardSchema = z.object({
  student_id: z.string().min(1, '学籍番号は必須です').max(64),
  company_name: z.string().min(1, '企業名は必須です').max(200),
  hojin_number: z.string().regex(/^\d{13}$/, '法人番号は13桁の数字である必要があります').optional().nullable().or(z.literal('')),
});

// Card Update Schema
export const updateCardSchema = z.object({
  status: z.enum(['予定', '選考中', '内定', '終了']).optional(),
  job_title: z.string().max(200).optional().nullable(),
  steps_json: z.string().refine((val) => {
    if (!val) return true;
    try {
      const parsed = JSON.parse(val);
      return z.array(applicationStepSchema).max(100).safeParse(parsed).success;
    } catch {
      return false;
    }
  }, { message: 'steps_json は選考ステップの配列である必要があります' }).optional().nullable(),
  memo: z.string().max(10000).optional().nullable(),
});

// Student Update Schema (Admin)
export const updateStudentSchema = z.object({
  is_completed: z.union([z.boolean(), z.number()]).transform((val) => typeof val === 'boolean' ? (val ? 1 : 0) : val).optional(),
  parent_email: z.string().email('正しいメールアドレス形式で入力してください').or(z.literal('')).optional().nullable(),
});

// Bulk Import Schema
export const bulkImportSchema = z.object({
  csv: z.string().min(1, 'CSVデータは必須です').max(1_000_000, 'CSVは1MB以下にしてください'),
});

// Templates Update Schema
export const saveTemplatesSchema = z.object({
  templates: z.record(z.string().max(100), z.string().max(100_000)),
});

// Send Email Schema
export const sendEmailSchema = z.object({
  to: z.string().email('正しいメールアドレスを入力してください'),
  subject: z.string().min(1, '件名は必須です').max(200),
  body: z.string().min(1, '本文は必須です').max(100_000),
});
