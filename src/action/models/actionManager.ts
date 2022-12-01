import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { ActionRepository, ACTION_REPOSITORY_SYMBOL } from '../DAL/typeorm/actionRepository';
import { Action, ActionParams, ActionStatus, UpdateableActionParams } from './action';

@injectable()
export class ActionManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(ACTION_REPOSITORY_SYMBOL) private readonly actionRepository: ActionRepository
  ) {}

  public async getActions(): Promise<Action[]> {
    this.logger.info({ msg: 'getting actions' });

    return this.actionRepository.findActions();
  }

  public async createAction(params: ActionParams): Promise<Action> {
    this.logger.info({ msg: 'creating action', action: '' });

    // TODO: should validate on registry?

    await this.actionRepository.findActions();

    const date = new Date();

    return { ...params, actionId: '1', status: ActionStatus.ACTIVE, createdAt: date, updatedAt: date };
  }

  public async updateAction(actionId: string, updateParams: UpdateableActionParams): Promise<void> {
    this.logger.info({ msg: 'updating action', actionId, ...updateParams });

    // TODO: should validate on registry?
    await this.actionRepository.findActions();

    // update
  }
}
