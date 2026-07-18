import { describe, expect, it } from 'vitest';
import { createTeacherSchema } from '@my-app/shared';

describe('teacher account validation', () => {
  it.each(['admin', 'ADMIN', 'administrator', 'root'])('rejects reserved shared ID %s', (id) => {
    expect(createTeacherSchema.safeParse({
      id, name: 'テスト教員', temporary_password: 'long-test-password',
    }).success).toBe(false);
  });

  it('requires an individual ID and a 12 character password', () => {
    expect(createTeacherSchema.safeParse({
      id: 'teacher.test', name: 'テスト教員', temporary_password: 'long-test-password',
    }).success).toBe(true);
    expect(createTeacherSchema.safeParse({
      id: 'teacher.test', name: 'テスト教員', temporary_password: 'short',
    }).success).toBe(false);
  });
});
