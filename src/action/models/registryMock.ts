import { Parallelism } from "./action";
import { ServiceNotRecognizedByRegistry } from "./errors";

export interface Service {
    serviceId: string;
    serviceRotation: number;
    parentRotation?: number;
    parallelism: Parallelism;
}

// TODO: replace with real registry call
export const getServiceFromRegistryMock = (serviceId: string): Service => {
    console.log('fetching service from registry');

    if (serviceId === 'badService') {
        throw new ServiceNotRecognizedByRegistry(`could not recognize service ${serviceId} on registry`);
    }

    return {
        serviceId,
        serviceRotation: 1,
        parentRotation: 1,
        parallelism: Parallelism.REPLACEABLE,
    };
};
