export interface UpdateableActionParams {
  status: ActionStatus;
  metadata?: Record<string, unknown>;
}

export interface ActionParams extends UpdateableActionParams {
  service: string;
  state: number;
}

export interface Action extends ActionParams {
  actionId: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date; // TODO: calc each time or as body param?
}

export enum ActionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
}
