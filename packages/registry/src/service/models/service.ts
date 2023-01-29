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
  namespaceId: string;

  name: string;

  createdAt: Date;

  updatedAt: Date;
}

export interface IService {
  serviceId: string;

  namespaceId: string;

  rotationId: number;

  name: string;

  parallalism: Parallelism;

  type: ServiceType;

  parentServiceId: string | null;

  createdAt: Date;

  updatedAt: Date;
}

export interface IRotation {
  serviceId: string;

  rotationId: number;

  description: string;

  createdAt: Date;

  updatedAt: Date;
}
