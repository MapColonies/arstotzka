import { FlattedDetailedService } from '@map-colonies/arstotzka-common';
import { IService } from '../../../../src/service/models/service';

export type StringifiedFlattedDetailedService = Omit<FlattedDetailedService, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export const stringifyService = (
  service: IService,
  children: IService[] = [],
  blockees: IService[] = [],
  namespace = 'main'
): StringifiedFlattedDetailedService => {
  return {
    namespaceId: service.namespaceId,
    namespaceName: namespace,
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.serviceType,
    parallelism: service.parallelism,
    parent: service.parentServiceId,
    children: children.map((child) => child.id),
    blockees: blockees.map((blockee) => ({ serviceName: blockee.name, serviceId: blockee.id })),
    parentRotation: service.parentServiceId !== null ? 1 : null,
    serviceRotation: 1,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
};
