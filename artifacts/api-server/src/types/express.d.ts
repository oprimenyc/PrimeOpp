import type { AdminRole } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      id?: string;
      adminUser?: {
        id: number;
        email: string;
        role: AdminRole;
      };
    }
  }
}

export {};
