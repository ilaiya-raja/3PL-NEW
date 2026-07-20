import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { PortalUserSession, PortalRole } from '@wms/types';

function resolveApiUrl(): string {
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

const API_URL = resolveApiUrl();

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const res = await fetch(`${API_URL}/auth/portal/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) {
            return null;
          }

          const body = (await res.json()) as {
            data?: {
              accessToken: string;
              refreshToken?: string;
              user: {
                id: string;
                email: string;
                name: string;
                role: string;
                clientId?: string;
                branding?: {
                  primaryColor?: string;
                  logoUrl?: string;
                  companyName?: string;
                };
              };
            };
          };

          const data = body.data;
          if (!data?.accessToken || !data.user?.clientId) {
            return null;
          }

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
            clientId: data.user.clientId,
            accessToken: data.accessToken,
            branding: data.user.branding,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.clientId = user.clientId;
        token.accessToken = user.accessToken;
        token.branding = user.branding;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as PortalUserSession).id = token.id as string;
        (session.user as PortalUserSession).role = token.role as PortalRole;
        (session.user as PortalUserSession).clientId = token.clientId as string;
        (session.user as PortalUserSession).branding = token.branding as {
          primaryColor?: string;
          logoUrl?: string;
          companyName?: string;
        };
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
