import { faker } from '@faker-js/faker';
import { Action, ActionStatus, FlattedDetailedService, Parallelism, ServiceType, Sort } from '@map-colonies/vector-management-common';
import { ActionParams } from '../../../../src/action/models/action';

type HasProperty<K extends string, V> = {
  [P in K]: V;
};

type GeneratedActionParams = ActionParams & { namespaceId?: number; serviceRotation?: number; parentRotation?: number; status?: ActionStatus };

export type StringifiedAction = Omit<Action, 'createdAt' | 'updatedAt' | 'closedAt'> & {
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

export const generateAction = (params: Partial<GeneratedActionParams> = {}): GeneratedActionParams => {
  return {
    ...generateActionParams(params),
    namespaceId: params.namespaceId ?? faker.datatype.number(),
    serviceRotation: params.serviceRotation ?? faker.datatype.number(),
    parentRotation: params.parentRotation ?? faker.datatype.number(),
    status: params.status ?? undefined,
  };
};

export const generateActionParams = (params: Partial<ActionParams> = {}): ActionParams => {
  return {
    serviceId: params.serviceId ?? faker.datatype.uuid(),
    state: params.state ?? faker.datatype.number(),
    metadata: params.metadata ?? (JSON.parse(faker.datatype.json()) as Record<string, unknown>),
  };
};

export const stringifyAction = (action: Action): StringifiedAction => {
  return {
    ...action,
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
    closedAt: action.closedAt ? action.closedAt.toISOString() : null,
  };
};

export const stringifyActions = (actions: Action[]): StringifiedAction[] => {
  return actions.map((action) => stringifyAction(action));
};

export const sortByDate = <T extends HasProperty<K, Date | string>, K extends keyof T & string>(data: T[], key: K, sort: Sort): T[] => {
  return data.sort((itemA, itemB) => {
    const dateA = +new Date(itemA[key]);
    const dateB = +new Date(itemB[key]);
    return sort === 'desc' ? dateB - dateA : dateA - dateB;
  });
};

export const generateGetServiceResponse = (params: Partial<FlattedDetailedService> = {}): FlattedDetailedService => {
  return {
    namespaceId: params.namespaceId ?? faker.datatype.number(),
    namespaceName: params.namespaceName ?? faker.datatype.string(),
    serviceId: params.serviceId ?? faker.datatype.uuid(),
    serviceName: params.serviceName ?? faker.datatype.string(),
    serviceType: params.serviceType ?? ServiceType.CONSUMER,
    parallelism: params.parallelism ?? Parallelism.SINGLE,
    parent: params.parent ?? null,
    serviceRotation: params.serviceRotation ?? faker.datatype.number(),
    parentRotation: params.parentRotation ?? null,
    children: params.children ?? [],
    blockees: params.blockees ?? [],
    createdAt: params.createdAt ?? faker.date.past(),
    updatedAt: params.updatedAt ?? faker.date.past(),
  };
};
