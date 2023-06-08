import { FlattedDetailedService } from '@map-colonies/arstotzka-common';
import { DetailedService } from './service';

export const flattenDetailedService = (service: Required<DetailedService>, children: string[]): FlattedDetailedService => {
  const {
    namespace,
    name: serviceName,
    serviceType,
    id: serviceId,
    parallelism,
    parentServiceId: parent,
    rotations,
    blocks,
    createdAt,
    updatedAt,
  } = service;

  const { namespaceId, name: namespaceName } = namespace;

  const { serviceRotation, parentRotation } = rotations[0];

  const blockees = blocks.map((block) => ({ serviceId: block.blockeeId, serviceName: block.blockeeService.name }));

  return {
    namespaceId,
    namespaceName,
    serviceId,
    serviceName,
    serviceType,
    parallelism,
    serviceRotation,
    parent,
    parentRotation,
    children,
    blockees,
    createdAt,
    updatedAt,
  };
};
