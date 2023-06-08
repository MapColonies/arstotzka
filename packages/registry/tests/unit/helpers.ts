import { faker } from '@faker-js/faker';
import { FlattedDetailedService, Parallelism, ServiceType } from '@map-colonies/arstotzka-common';
import { DetailedService, IBlock, IRotation } from '../../src/service/models/service';

const MAX_GENERATED_STRING_LENGTH = 10;

const generateRotation = (params: Partial<IRotation> = {}): IRotation => {
  return {
    rotationId: params.rotationId ?? faker.datatype.uuid(),
    serviceId: params.serviceId ?? faker.datatype.uuid(),
    serviceRotation: params.serviceRotation ?? faker.datatype.number(),
    parentRotation: params.parentRotation ?? faker.datatype.number(),
    description: params.description ?? faker.datatype.string(MAX_GENERATED_STRING_LENGTH),
    createdAt: params.createdAt ?? faker.date.recent(),
    updatedAt: params.updatedAt ?? faker.date.recent(),
  };
};

export const MOCK_ROTATION_LOCK_EXPIRATION = 2000;

export const generateBlock = (params: Partial<IBlock> = {}): IBlock => {
  return {
    blockerId: params.blockerId ?? faker.datatype.uuid(),
    blockeeId: params.blockeeId ?? faker.datatype.uuid(),
    blockerService: params.blockerService ?? generateService()[0],
    blockeeService: params.blockeeService ?? generateService()[0],
  };
};

export const generateService = (params: Partial<DetailedService> = {}): [DetailedService, FlattedDetailedService] => {
  const namespaceId = params.namespaceId ?? faker.datatype.number();

  const service = {
    id: params.id ?? faker.datatype.uuid(),
    namespaceId,
    namespace: {
      namespaceId,
      name: params.name ?? faker.datatype.string(MAX_GENERATED_STRING_LENGTH),
      createdAt: params.namespace?.createdAt ?? faker.date.recent(),
      updatedAt: params.namespace?.updatedAt ?? faker.date.recent(),
    },
    rotations: params.rotations ?? [generateRotation()],
    name: params.name ?? faker.datatype.string(MAX_GENERATED_STRING_LENGTH),
    parallelism: params.parallelism ?? Parallelism.SINGLE,
    serviceType: params.serviceType ?? ServiceType.CONSUMER,
    parentServiceId: params.parentServiceId ?? null,
    createdAt: params.createdAt ?? faker.date.recent(),
    updatedAt: params.updatedAt ?? faker.date.recent(),
  };

  const flattenedService = {
    namespaceId,
    namespaceName: service.namespace.name,
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.serviceType,
    parallelism: service.parallelism,
    serviceRotation: service.rotations[0].serviceRotation,
    parent: service.parentServiceId,
    parentRotation: service.rotations[0].parentRotation,
    children: [],
    blockees: [],
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };

  return [service, flattenedService];
};
