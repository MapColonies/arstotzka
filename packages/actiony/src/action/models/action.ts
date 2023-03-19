import { ActionStatus } from '@map-colonies/vector-management-common';
import { ACTION_IDENTIFIER_COLUMN } from '../DAL/typeorm/action';

export interface ActionId {
  [ACTION_IDENTIFIER_COLUMN]: string;
}

export interface UpdatableActionParams {
  status?: ActionStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- typeorm's QueryDeepPartialEntity does not recognize unknown types
  metadata?: Record<string, any> | null;
}

export interface ActionParams extends Omit<UpdatableActionParams, 'status'> {
  serviceId: string;
  state: number;
}

export interface CreateActionParams extends ActionParams {
  namespaceId: number;
  serviceRotation: number;
  parentRotation: number | null;
}
