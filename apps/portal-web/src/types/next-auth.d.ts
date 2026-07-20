declare module 'next-auth' {
  interface Session {
    accessToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      clientId: string;
      branding?: {
        primaryColor?: string;
        logoUrl?: string;
        companyName?: string;
      };
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    clientId: string;
    accessToken: string;
    branding?: {
      primaryColor?: string;
      logoUrl?: string;
      companyName?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    clientId: string;
    accessToken: string;
    branding?: {
      primaryColor?: string;
      logoUrl?: string;
      companyName?: string;
    };
  }
}

export {};
