export interface UpdatableActionParams {
  status?: ActionStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- typeorm's QueryDeepPartialEntity does not recognize unknown types
  metadata?: Record<string, any>;
}

export interface ActionParams extends Omit<UpdatableActionParams, 'status'> {
  serviceId: string;
  state: number;
  namespaceId: number;
}

export interface Action extends ActionParams {
  namespaceId: number;
  actionId: string;
  rotationId: number;
  parentRotationId?: number;
  status: ActionStatus;
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
  rotation?: number;
  parentRotation?: number;
  status?: ActionStatus[];
  limit?: number;
  sort?: Sort;
}

export enum Parallelism {
  SINGLE = 'single',
  REPLACEABLE = 'replaceable',
  MULTIPLE = 'multiple',
}
