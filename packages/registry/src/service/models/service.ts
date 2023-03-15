interface IDbEntity {
  createdAt: Date;
  updatedAt: Date;
}

export enum Parallelism {
  SINGLE = 'single',
  REPLACEABLE = 'replaceable',
  MULTIPLE = 'multiple',
}

export enum ServiceType {
  PRODUCER = 'producer',
  CONSUMER = 'consumer',
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
}

export interface DetailedService extends IService {
  namespace?: INamespace;
  rotations?: IRotation[];
  blocks?: IBlock[];
}

export interface FlattedDetailedService {
  namespaceId: number;
  namespaceName: string;
  serviceId: string;
  serviceName: string;
  serviceType: ServiceType;
  serviceRotation: number;
  parallelism: Parallelism;
  parent: string | null;
  parentRotation: number | null;
  children: string[];
  blockees: string[];
  createdAt: Date;
  updatedAt: Date;
}
