import { hc } from 'hono/client';
import type { AppType } from '@my-app/backend';

const baseUrl = (import.meta.env.VITE_API_URL as string) || '/';
const client = hc<AppType>(baseUrl, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    try {
      const session = JSON.parse(localStorage.getItem('yojitsu_session') || 'null');
      if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
    } catch {
      // A malformed local session is handled by the app's session restore flow.
    }
    return fetch(input, { ...init, headers }).then((response) => {
      if (response.status === 401 && headers.has('Authorization')) {
        localStorage.removeItem('yojitsu_session');
        window.dispatchEvent(new Event('yojitsu:unauthorized'));
      }
      return response;
    });
  },
});

export default client;
