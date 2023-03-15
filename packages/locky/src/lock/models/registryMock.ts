import { ServiceNotRecognizedByRegistry } from './errors';

const TIMEOUT_MS = 250;

export interface Service {
  serviceId: string;
  serviceRotation: number;
  parentRotation?: number;
  parallelism: 'single';
  blockees: string[];
}

// TODO: replace with real registry call
export const getServiceFromRegistryMock = async (serviceId: string): Promise<Service> => {
  // timeout to simulate async call
  await new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS));

  if (serviceId === 'badService') {
    throw new ServiceNotRecognizedByRegistry(`could not recognize service ${serviceId} on registry`);
  }

  return {
    serviceId,
    serviceRotation: 1,
    parentRotation: 1,
    parallelism: 'single',
    blockees: ['id1', 'id2'],
  };
};
