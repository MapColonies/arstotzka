import { LOCK_IDENTIFIER_COLUMN } from '../DAL/typeorm/lock';

export interface LockId {
  [LOCK_IDENTIFIER_COLUMN]: string;
}

export interface ILock {
  lockId: string;
  serviceIds: string[];
  expiresAt: Date | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
