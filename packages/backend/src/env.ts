import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

export type ReadonlyD1Database = {
  prepare(query: `SELECT ${string}`): D1PreparedStatement;
};

export type Bindings = {
  DB: D1Database;
  SOURCE_DB: ReadonlyD1Database;
  ADMIN_ID: string;
  JWT_SECRET: string;
  ALLOWED_ORIGIN?: string;
  SYNC_ALERT_WEBHOOK?: string;
  GAS_EMAIL_URL: string;
  GAS_SECRET_TOKEN: string;
  GBIZINFO_API_KEY?: string;
};

export type AuthPayload = { sub: string; role: 'student' | 'admin'; exp: number };
export type Variables = { auth: AuthPayload };
