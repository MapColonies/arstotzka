import { Logger } from '@map-colonies/js-logger';
import { IMediator } from '@map-colonies/arstotzka-mediator';
import {
  Action,
  ActionAlreadyClosedError,
  ActionFilter,
  ActionNotFoundError,
  ActionParams,
  ActionStatus,
  FlattedDetailedService,
  Parallelism,
  ParallelismMismatchError,
  UpdatableActionParams,
} from '@map-colonies/arstotzka-common';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { ActionRepository, ACTION_CLOSED_STATUSES, ACTION_REPOSITORY_SYMBOL } from '../DAL/typeorm/actionRepository';
import { CreateActionParams } from './action';
import { parallelismToActiveLimitation } from './util';

@injectable()
export class ActionManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(ACTION_REPOSITORY_SYMBOL) private readonly actionRepository: ActionRepository,
    @inject(SERVICES.MEDIATOR) private readonly mediator: IMediator
  ) {}

  public async getActions(filter: ActionFilter): Promise<Action[]> {
    this.logger.info({ msg: 'getting actions matching the following filter', filter });

    return this.actionRepository.findActions(filter);
  }

  public async createAction(params: ActionParams): Promise<string> {
    this.logger.info({ msg: 'fetching service from registry', serviceId: params.serviceId });

    const service = await this.mediator.fetchService(params.serviceId);

    this.logger.info({ msg: "validating service's action parallelism", service });

    await this.validateParallelism(service);

    this.logger.info({ msg: 'attempting to create action with the following params', params, service });

    let actionId: string;

    const actionParams: CreateActionParams = {
      ...params,
      namespaceId: service.namespaceId,
      serviceRotation: service.serviceRotation,
      parentRotation: service.parentRotation,
    };

    if (service.parallelism === Parallelism.SINGLE || service.parallelism === Parallelism.MULTIPLE) {
      actionId = await this.actionRepository.createAction(actionParams);
    } else {
      actionId = await this.actionRepository.updateLastAndCreate(
        { status: ActionStatus.CANCELED, metadata: { closingReason: 'canceled by parallelism rules' } },
        actionParams
      );
    }

    this.logger.info({ msg: 'created action', actionId, serviceId: params.serviceId, namespaceId: service.namespaceId });

    return actionId;
  }

  public async updateAction(actionId: string, updateParams: UpdatableActionParams): Promise<void> {
    const action = await this.actionRepository.findOneActionById(actionId);

    if (action === null) {
      this.logger.error({ msg: 'action not found for update', actionId });
      throw new ActionNotFoundError(`action ${actionId} not found`);
    }

    if (ACTION_CLOSED_STATUSES.includes(action.status)) {
      this.logger.error({ msg: 'action has already been closed', actionId, actionStatus: action.status });
      throw new ActionAlreadyClosedError(`action ${actionId} has already been closed with status ${action.status}`);
    }

    this.logger.info({ msg: 'updating action with the follwing params', actionId, params: updateParams });

    await this.actionRepository.updateOneAction(actionId, { ...updateParams, metadata: { ...action.metadata, ...updateParams.metadata } });
  }

  private async validateParallelism(service: FlattedDetailedService): Promise<void> {
    const activeLimitation = parallelismToActiveLimitation(service.parallelism);

    if (activeLimitation === Infinity) {
      return;
    }

    const activeActions = await this.actionRepository.countActions({ service: service.serviceId, status: [ActionStatus.ACTIVE] });

    if (activeActions > activeLimitation) {
      this.logger.error({ msg: 'service parallelism mismatch', service, activeActions, activeLimitation });
      throw new ParallelismMismatchError(`service ${service.serviceId} has mismatched parallelism`);
    }
  }
}
