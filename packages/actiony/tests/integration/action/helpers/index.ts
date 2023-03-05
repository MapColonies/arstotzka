import { faker } from '@faker-js/faker';
import { Action, ActionParams, ActionStatus, Parallelism, Sort } from '../../../../src/action/models/action';
import { Service } from '../../../../src/action/models/registryMock';

type HasProperty<K extends string, V> = {
  [P in K]: V;
};

type GeneratedActionParams = ActionParams & { rotationId?: number; parentRotationId?: number; status?: ActionStatus };

export type StringifiedAction = Omit<Action, 'createdAt' | 'updatedAt' | 'closedAt'> & {
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

export const generateAction = (params: Partial<GeneratedActionParams> = {}): GeneratedActionParams => {
  return {
    ...generateActionParams(params),
    rotationId: params.rotationId ?? faker.datatype.number(),
    parentRotationId: params.parentRotationId ?? faker.datatype.number(),
    status: params.status ?? undefined,
  };
};

export const generateActionParams = (params: Partial<ActionParams> = {}): ActionParams => {
  return {
    serviceId: params.serviceId ?? faker.datatype.uuid(),
    namespaceId: params.namespaceId ?? faker.datatype.number(),
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

export const generateGetServiceResponse = (params: Partial<Service> = {}): Service => {
  return {
    serviceId: params.serviceId ?? faker.datatype.uuid(),
    parallelism: params.parallelism ?? Parallelism.SINGLE,
    serviceRotation: params.serviceRotation ?? faker.datatype.number(),
    parentRotation: params.parentRotation ?? faker.datatype.number(),
  };
};
