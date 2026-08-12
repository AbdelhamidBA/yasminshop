import type {DefaultSession} from 'next-auth';

type AppRole = 'ADMIN' | 'SUB_ADMIN' | 'CLIENT';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {id: string; role: AppRole; tokenVersion: number};
  }
  interface User {
    role: AppRole;
    // Carried from authorize() into the JWT on sign-in; re-checked against the
    // DB on protected surfaces for session revocation.
    tokenVersion?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: AppRole;
    tokenVersion?: number;
  }
}
