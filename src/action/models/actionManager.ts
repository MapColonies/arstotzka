import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { ACTION_IDENTIFIER_COLUMN } from '../DAL/typeorm/action';
import { ActionRepository, ACTION_REPOSITORY_SYMBOL } from '../DAL/typeorm/actionRepository';
import { Action, ActionFilter, ActionParams, ActionStatus, UpdatableActionParams } from './action';
import { ActionAlreadyClosedError, ActionNotFoundError } from './errors';

const ACTION_CLOSED_STATUSES = [ActionStatus.COMPLETED, ActionStatus.FAILED, ActionStatus.CANCELED];

@injectable()
export class ActionManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(ACTION_REPOSITORY_SYMBOL) private readonly actionRepository: ActionRepository
  ) {}

  public async getActions(filter: ActionFilter): Promise<Action[]> {
    this.logger.info({ msg: 'getting actions matching the following filter', filter });

    return this.actionRepository.findActions(filter);
  }

  public async createAction(params: ActionParams): Promise<string> {
    this.logger.info({ msg: 'creating action with the following params', params });

    const creationRes = await this.actionRepository.createAction(params);

    const actionId = creationRes.identifiers[0][ACTION_IDENTIFIER_COLUMN] as string;

    this.logger.info({ msg: 'created action', actionId });

    return actionId;
  }

  public async updateAction(actionId: string, updateParams: UpdatableActionParams): Promise<void> {
    const action = await this.actionRepository.findOneActionById(actionId);

    if (action === null) {
      this.logger.error({ msg: 'action not found for update', actionId });
      throw new ActionNotFoundError(`actionId ${actionId} not found`);
    }

    if (ACTION_CLOSED_STATUSES.includes(action.status)) {
      this.logger.error({ msg: 'action already closed', actionId, actionStatus: action.status });
      throw new ActionAlreadyClosedError(`action ${actionId} has already been closed with status ${action.status}`);
    }

    this.logger.info({ msg: 'updating action with the follwing params', actionId, params: updateParams });

    await this.actionRepository.updateOneAction(actionId, updateParams);
  }
}
