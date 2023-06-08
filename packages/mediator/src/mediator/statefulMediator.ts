import { ActionParams, UpdatableActionParams } from '@map-colonies/arstotzka-common';
import { MediatorOptions } from './config';
import { Mediator } from '.';

export interface StatefulMediatorOptions extends MediatorOptions {
  serviceId: string;
}

export class StatefulMediator extends Mediator {
  private readonly serviceId: string;
  private lockId?: { lockId: string };
  private actionId?: { actionId: string };

  public constructor(options: StatefulMediatorOptions) {
    super(options);
    this.serviceId = options.serviceId;
  }

  public override async reserveAccess(): Promise<{ lockId: string } | undefined> {
    this.lockId = await super.reserveAccess(this.serviceId);
    return this.lockId;
  }

  public override async removeLock(): Promise<void> {
    if (!this.lockId) {
      return;
    }

    // TODO: wrap in try catch and ignore not found
    await super.removeLock(this.lockId.lockId);
    this.lockId = undefined;
  }

  public override async createAction(params: Omit<ActionParams, 'serviceId'>): Promise<{ actionId: string }> {
    this.actionId = await super.createAction({ ...params, serviceId: this.serviceId });
    return this.actionId;
  }

  public override async updateAction(params: UpdatableActionParams): Promise<void> {
    if (!this.actionId) {
      return;
    }

    await super.updateAction(params, this.actionId.actionId);
  }
}
