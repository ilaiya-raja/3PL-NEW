import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

function resolveApiUrl(): string {
  // Prefer NEXT_PUBLIC_API_URL — root .env often sets API_URL without /api/v1
  // and process.env from the shell can override .env.local.
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    'http://localhost:4000/api/v1';
  const trimmed = raw.replace(/\/$/, '');
  if (trimmed.endsWith('/api/v1')) {
    return trimmed;
  }
  return `${trimmed}/api/v1`;
}

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === 'development',
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim();
        const password = credentials?.password;
        if (!email || !password) {
          console.error('[ops-auth] missing email/password');
          return null;
        }

        const apiUrl = resolveApiUrl();
        const loginUrl = `${apiUrl}/auth/login`;

        try {
          const res = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            cache: 'no-store',
          });

          const body: unknown = await res.json().catch(() => null);
          if (!res.ok) {
            console.error('[ops-auth] login failed', res.status, body);
            return null;
          }

          const payload =
            body && typeof body === 'object' && 'data' in body
              ? (body as { data: Record<string, unknown> }).data
              : null;

          if (!payload || typeof payload !== 'object') {
            console.error('[ops-auth] unexpected response shape', body);
            return null;
          }

          const accessToken = payload.accessToken;
          const refreshToken = payload.refreshToken;
          const user = payload.user;

          if (
            typeof accessToken !== 'string' ||
            typeof refreshToken !== 'string' ||
            !user ||
            typeof user !== 'object'
          ) {
            console.error('[ops-auth] missing tokens/user', payload);
            return null;
          }

          const u = user as Record<string, unknown>;
          if (
            typeof u.id !== 'string' ||
            typeof u.email !== 'string' ||
            typeof u.name !== 'string' ||
            typeof u.role !== 'string'
          ) {
            console.error('[ops-auth] incomplete user', u);
            return null;
          }

          return {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role as
              | 'ADMIN'
              | 'SUPERVISOR'
              | 'WAREHOUSE_OPS'
              | 'BILLING'
              | 'READONLY',
            accessToken,
            refreshToken,
          };
        } catch (error) {
          console.error('[ops-auth] exception calling', loginUrl, error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email ?? '';
        token.name = user.name ?? '';
        token.role = user.role;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email,
        name: token.name,
        role: token.role,
      };
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      return session;
    },
  },
};
