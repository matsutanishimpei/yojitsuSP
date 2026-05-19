import { z } from 'zod';

// Login Validation Schema
export const loginSchema = z.object({
  student_id: z.string().min(1, '学籍番号は必須です'),
  parent_birthday: z.string().length(4, '誕生日は4桁で入力してください (例: 0309)'),
});

// Selection Step Schema
export const applicationStepSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付は YYYY-MM-DD 形式にしてください'),
  name: z.string().min(1, '選考段階名は必須です'),
  result: z.enum(['', '合格', '不合格', '辞退']),
});

// Card Creation Schema
export const createCardSchema = z.object({
  student_id: z.string().min(1, '学籍番号は必須です'),
  company_name: z.string().min(1, '企業名は必須です'),
  hojin_number: z.string().regex(/^\d{13}$/, '法人番号は13桁の数字である必要があります').optional().nullable().or(z.literal('')),
});

// Card Update Schema
export const updateCardSchema = z.object({
  status: z.enum(['予定', '選考中', '内定', '終了']).optional(),
  job_title: z.string().optional().nullable(),
  steps_json: z.string().refine((val) => {
    if (!val) return true;
    try {
      const parsed = JSON.parse(val);
      return z.array(applicationStepSchema).safeParse(parsed).success;
    } catch {
      return false;
    }
  }, { message: 'steps_json は選考ステップの配列である必要があります' }).optional().nullable(),
  memo: z.string().optional().nullable(),
});

// Student Update Schema (Admin)
export const updateStudentSchema = z.object({
  is_completed: z.union([z.boolean(), z.number()]).transform((val) => typeof val === 'boolean' ? (val ? 1 : 0) : val).optional(),
  parent_email: z.string().email('正しいメールアドレス形式で入力してください').or(z.literal('')).optional().nullable(),
});

// Bulk Import Schema
export const bulkImportSchema = z.object({
  csv: z.string().min(1, 'CSVデータは必須です'),
});

// Templates Update Schema
export const saveTemplatesSchema = z.object({
  templates: z.record(z.string(), z.string()),
});

// Send Email Schema
export const sendEmailSchema = z.object({
  to: z.string().email('正しいメールアドレスを入力してください'),
  subject: z.string().min(1, '件名は必須です'),
  body: z.string().min(1, '本文は必須です'),
});
