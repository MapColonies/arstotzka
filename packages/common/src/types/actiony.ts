export interface UpdatableActionParams {
  status?: ActionStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- typeorm's QueryDeepPartialEntity does not recognize unknown types
  metadata?: Record<string, any> | null;
}

export interface ActionParams extends Omit<UpdatableActionParams, 'status'> {
  serviceId: string;
  state: number;
}

export interface Action extends ActionParams {
  namespaceId: number;
  actionId: string;
  serviceRotation: number;
  parentRotation: number | null;
  status: ActionStatus;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

export enum ActionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export type Sort = 'asc' | 'desc';

export interface ActionFilter {
  service?: string;
  serviceRotation?: number;
  parentRotation?: number;
  status?: ActionStatus[];
  limit?: number;
  sort?: Sort;
}
