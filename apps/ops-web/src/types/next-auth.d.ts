import 'next-auth';
import 'next-auth/jwt';

type OpsRole =
  | 'ADMIN'
  | 'SUPERVISOR'
  | 'WAREHOUSE_OPS'
  | 'BILLING'
  | 'READONLY';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: OpsRole;
    };
    accessToken: string;
    refreshToken: string;
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: OpsRole;
    accessToken: string;
    refreshToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;
    role: OpsRole;
    accessToken: string;
    refreshToken: string;
  }
}
