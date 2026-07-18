import { z } from 'zod';
import {
  loginSchema,
  adminLoginSchema,
  createTeacherSchema,
  updateTeacherAccessSchema,
  applicationStepSchema,
  createCardSchema,
  updateCardSchema,
  updateStudentSchema,
  bulkImportSchema,
  saveTemplatesSchema,
  sendEmailSchema,
} from '../schemas';

export type LoginInput = z.infer<typeof loginSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherAccessInput = z.infer<typeof updateTeacherAccessSchema>;
export type ApplicationStep = z.infer<typeof applicationStepSchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
export type SaveTemplatesInput = z.infer<typeof saveTemplatesSchema>;
export type SendEmailInput = z.infer<typeof sendEmailSchema>;

// Database entity types
export interface Student {
  id: string;
  name: string;
  parent_birthday: string | null;
  parent_email: string | null;
  is_completed: number; // 0: uncompleted, 1: completed
}

export interface ApplicationCard {
  id: number;
  student_id: string;
  company_name: string;
  job_title: string | null;
  hojin_number: string | null;
  status: '予定' | '選考中' | '内定' | '終了';
  current_step: string;
  steps_json: string | null;
  memo: string | null;
  updated_at: string;
}

export interface MailTemplate {
  key: string;
  value: string;
}

export interface AdminStudentSummary {
  student_id: string;
  student_name: string;
  parent_email: string | null;
  is_completed: number;
  active_count: number;
  offer_count: number;
  closed_count: number;
  last_updated: string | null;
  active_steps: string | null;
}

export interface CompanyMatrixItem {
  company_name: string;
  hojin_number: string | null;
  status: ApplicationCard['status'];
  student_id: string;
  student_name: string;
}

export interface CompanySearchResult {
  name: string;
  number: string;
}

export interface TeacherAccount {
  id: string;
  name: string;
  source_managed: number;
  is_active: number;
  source_deleted_at: string | null;
  synced_at: string | null;
}

export type CardsByStatus = Record<'選考中' | '内定' | '終了', ApplicationCard[]>;
