import { Parallelism, ServiceType } from '@map-colonies/arstotzka-common';

interface IDbEntity {
  createdAt: Date;
  updatedAt: Date;
}

export interface INamespace extends IDbEntity {
  namespaceId: number;
  name: string;
}

export interface IService extends IDbEntity {
  id: string;
  namespaceId: number;
  name: string;
  parallelism: Parallelism;
  serviceType: ServiceType;
  parentServiceId: string | null;
}

export interface IRotation extends IDbEntity {
  rotationId: string;
  serviceId: string;
  serviceRotation: number;
  parentRotation: number | null;
  description: string | null;
}

export interface IBlock {
  blockerId: string;
  blockeeId: string;
  blockeeService?: IService;
  blockerService?: IService;
}

export interface DetailedService extends IService {
  namespace?: INamespace;
  rotations?: IRotation[];
  blocks?: Required<IBlock>[];
}

export interface RotationRequest {
  serviceId: string;
  description?: string;
}
