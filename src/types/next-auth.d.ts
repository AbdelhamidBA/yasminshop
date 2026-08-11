import type {DefaultSession} from 'next-auth';

type AppRole = 'ADMIN' | 'SUB_ADMIN' | 'CLIENT';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {id: string; role: AppRole};
  }
  interface User {
    role: AppRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: AppRole;
  }
}
