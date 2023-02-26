export interface ILock {
  lockId: string;

  serviceIds: string[];

  expiresAt?: Date;

  reason?: string;

  createdAt: Date;

  updatedAt: Date;
}
