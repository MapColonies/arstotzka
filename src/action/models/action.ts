export interface UpdatableActionParams {
  status: ActionStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- typeorm's QueryDeepPartialEntity does not recognize unknown types
  metadata?: Record<string, any>;
}

export interface ActionParams extends Omit<UpdatableActionParams, 'status' | 'closedAt'> {
  service: string;
  state: number;
}

export interface Action extends ActionParams, UpdatableActionParams {
  actionId: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
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
  status?: ActionStatus[];
  limit?: number;
  sort?: Sort;
}
