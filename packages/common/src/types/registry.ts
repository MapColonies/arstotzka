export enum Parallelism {
  SINGLE = 'single',
  REPLACEABLE = 'replaceable',
  MULTIPLE = 'multiple',
}

export enum ServiceType {
  PRODUCER = 'producer',
  CONSUMER = 'consumer',
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
