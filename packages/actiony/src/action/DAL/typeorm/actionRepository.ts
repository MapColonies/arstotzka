import { DataSource, EntityManager, FindManyOptions, FindOneOptions, FindOptions, FindOptionsWhere, In } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { FactoryFunction } from 'tsyringe';
import { Action, ActionFilter, ActionStatus, ParallelismMismatchError, UpdatableActionParams } from '@map-colonies/arstotzka-common';
import { DATA_SOURCE_PROVIDER } from '../../../common/db';
import { CreateActionParams } from '../../models/action';
import { Action as ActionEntity, ACTION_IDENTIFIER_COLUMN } from './action';

const filterToOptions = (filter: ActionFilter): FindOptionsWhere<ActionEntity> => {
  const options: FindOptionsWhere<ActionEntity> = {};
  if (filter.service !== undefined) {
    options.serviceId = filter.service;
  }

  if (filter.serviceRotation !== undefined) {
    options.serviceRotation = filter.serviceRotation;
  }

  if (filter.parentRotation !== undefined) {
    options.parentRotation = filter.parentRotation;
  }

  if (filter.status !== undefined) {
    options.status = In(filter.status);
  }

  return options;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createActionRepository = (dataSource: DataSource) => {
  return dataSource.getRepository(ActionEntity).extend({
    async findActions(filter: ActionFilter, transactionManager?: EntityManager, lock?: FindManyOptions['lock']): Promise<ActionEntity[]> {
      const scopedManager: EntityManager = transactionManager ?? this.manager;
      return scopedManager.find(ActionEntity, { where: filterToOptions(filter), order: { createdAt: filter.sort }, take: filter.limit, lock });
    },
    async countActions(filter: ActionFilter, transactionManager?: EntityManager): Promise<number> {
      const scopedManager: EntityManager = transactionManager ?? this.manager;
      return scopedManager.countBy(ActionEntity, filterToOptions(filter));
    },
    async findOneActionById(actionId: string, transactionManager?: EntityManager): Promise<Action | null> {
      const scopedManager: EntityManager = transactionManager ?? this.manager;
      return scopedManager.findOneBy(ActionEntity, { actionId });
    },
    async createAction(params: CreateActionParams, transactionManager?: EntityManager): Promise<string> {
      const scopedManager: EntityManager = transactionManager ?? this.manager;
      const insertResult = await scopedManager
        .createQueryBuilder()
        .insert()
        .into(ActionEntity)
        .values(params)
        .returning([ACTION_IDENTIFIER_COLUMN])
        .execute();
      return insertResult.identifiers[0][ACTION_IDENTIFIER_COLUMN] as string;
    },
    async createActionOnlyIfInactive(params: CreateActionParams): Promise<string> {
      return this.manager.connection.transaction(async (transactionalEntityManager: EntityManager) => {
        const existingAction = await this.findActions(
          { service: params.serviceId, status: [ActionStatus.ACTIVE], sort: 'desc', limit: 1 },
          transactionalEntityManager,
          { mode: 'pessimistic_write' }
        );
        if (existingAction.length !== 0) {
          throw new ParallelismMismatchError(`could not create an action for service ${params.serviceId} due to parallelism mismatch`);
        }

        return this.createAction(params, transactionalEntityManager);
      });
    },
    async updateOneAction(actionId: string, updateParams: UpdatableActionParams, transactionManager?: EntityManager): Promise<void> {
      const scopedManager = transactionManager ?? this.manager;

      let finalParams: QueryDeepPartialEntity<Action> = updateParams;

      if (updateParams.status !== undefined && ACTION_CLOSED_STATUSES.includes(updateParams.status)) {
        finalParams = {
          ...updateParams,
          closedAt: () => 'LOCALTIMESTAMP',
        };
      }

      await scopedManager.createQueryBuilder(ActionEntity, 'action').update(finalParams).where({ actionId }).execute();
    },
    async updateLastAndCreate(updateParams: UpdatableActionParams, params: CreateActionParams): Promise<string> {
      return this.manager.connection.transaction(async (transactionalEntityManager: EntityManager) => {
        const actions = await this.findActions(
          { service: params.serviceId, status: [ActionStatus.ACTIVE], sort: 'desc', limit: 1 },
          transactionalEntityManager
        );

        if (actions.length !== 0) {
          const action = actions[0];
          const updatedMetadata = { ...action.metadata, ...updateParams.metadata };
          await this.updateOneAction(action.actionId, { ...updateParams, metadata: updatedMetadata }, transactionalEntityManager);
        }

        return this.createAction(params, transactionalEntityManager);
      });
    },
  });
};

export const ACTION_CLOSED_STATUSES = [ActionStatus.COMPLETED, ActionStatus.FAILED, ActionStatus.CANCELED];

export const ACTION_REPOSITORY_SYMBOL = Symbol('actionRepository');

export type ActionRepository = ReturnType<typeof createActionRepository>;

export const actionRepositoryFactory: FactoryFunction<ActionRepository> = (depContainer) => {
  const dataSource = depContainer.resolve<DataSource>(DATA_SOURCE_PROVIDER);
  return createActionRepository(dataSource);
};
