export enum Parallelism {
  SINGLE = 'single',
  REPLACEABLE = 'replaceable',
  MULTIPLE = 'multiple',
}

export enum ServiceType {
  PRODUCER = 'producer',
  CONSUMER = 'consumer',
}

export interface INamespace {
  namespaceId: number;

  name: string;

  createdAt: Date;

  updatedAt: Date;
}

export interface IService {
  serviceId: string;

  namespaceId: number;

  name: string;

  parallalism: Parallelism;

  serviceType: ServiceType;

  parentServiceId: string | null;

  createdAt: Date;

  updatedAt: Date;
}

export interface IRotation {
  serviceId: string;

  rotationId: number;

  parentRotationId?: number;

  description: string;

  createdAt: Date;

  updatedAt: Date;
}
