import { DataSource, FindOptionsWhere, In, InsertResult } from 'typeorm';
import { FactoryFunction } from 'tsyringe';
import { DATA_SOURCE_PROVIDER, DEFAULT_ORDER } from '../../../common/db';
import { Action, ActionFilter, ActionParams, UpdatableActionParams } from '../../models/action';
import { Action as ActionEntity, ACTION_IDENTIFIER_COLUMN } from './action';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createActionRepository = (dataSource: DataSource) => {
  return dataSource.getRepository(ActionEntity).extend({
    async findActions(filter: ActionFilter): Promise<ActionEntity[]> {
      const options: FindOptionsWhere<ActionEntity> = {};
      if (filter.service !== undefined) {
        options.service = filter.service;
      }

      if (filter.status !== undefined) {
        options.status = In(filter.status);
      }

      return this.find({ where: options, order: { createdAt: filter.sort ?? DEFAULT_ORDER }, take: filter.limit });
    },
    async findOneActionById(actionId: string): Promise<Action | null> {
      return this.findOneBy({ actionId });
    },
    async createAction(params: ActionParams): Promise<InsertResult> {
      return this.createQueryBuilder().insert().into(ActionEntity).values(params).returning([ACTION_IDENTIFIER_COLUMN]).execute();
    },
    async updateOneAction(actionId: string, updateParams: UpdatableActionParams): Promise<void> {
      await this.createQueryBuilder('action')
        .update({
          ...updateParams,
          closedAt: () => `CASE
       WHEN $1::action.action_action_status_enum IN ('completed', 'failed', 'canceled') THEN CURRENT_TIMESTAMP
       END`,
        })
        .where({ actionId })
        .execute();
    },
  });
};

export const ACTION_REPOSITORY_SYMBOL = Symbol('actionReository');

export type ActionRepository = ReturnType<typeof createActionRepository>;

export const actionRepositoryFactory: FactoryFunction<ActionRepository> = (depContainer) => {
  const dataSource = depContainer.resolve<DataSource>(DATA_SOURCE_PROVIDER);
  return createActionRepository(dataSource);
};
