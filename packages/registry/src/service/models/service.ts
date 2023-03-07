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
  serviceId: string;
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
  parentRotation?: number;
  description?: string;
}

export interface DetailedService extends IService {
  namespace: INamespace;
  rotations: IRotation[];
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
  parentRotation?: number;
  children: string[];
  createdAt: Date;
  updatedAt: Date;
}
