import { LockNotFoundError, ServiceAlreadyLockedError } from './errors';

const TIMEOUT_MS = 250;

export interface LockServicesRequest {
  services: string[];
  expiration: number;
  reason?: string;
}

export const lockServicesMock = async (request: LockServicesRequest): Promise<{ lockId: string }> => {
  // timeout to simulate async call
  await new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS));

  const { services } = request;
  if (services.includes('lockedService')) {
    throw new ServiceAlreadyLockedError(`could not lock one of requested services`);
  }

  return {
    lockId: 'secret',
  };
};

export const unlockServicesMock = async (lockId: string): Promise<void> => {
  // timeout to simulate async call
  await new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS));

  if (lockId === 'badLockId') {
    throw new LockNotFoundError(`lock with lockId ${lockId} could not be found`);
  }
};
