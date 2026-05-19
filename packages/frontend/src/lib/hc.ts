import { hc } from 'hono/client';
import type { AppType } from '@my-app/backend';

const baseUrl = (import.meta.env.VITE_API_URL as string) || '/';
const client = hc<AppType>(baseUrl);

export default client;
