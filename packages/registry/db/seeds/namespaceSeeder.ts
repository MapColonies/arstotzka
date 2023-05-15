import { homedir } from 'os';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Parallelism, ServiceType } from '@map-colonies/arstotzka-common';
import { Namespace } from '../../src/service/DAL/typeorm/namespace';
import { Service } from '../../src/service/DAL/typeorm/service';
import { Block } from '../../src/service/DAL/typeorm/block';
import { Rotation } from '../../src/service/DAL/typeorm/rotation';

const SEEDER_INPUT_FILE_NAME = 'arstotzka-namespace-seeder.json';

const INITAL_ROTATION_VALUE = 1;

interface ServiceSeedInput {
  name: string;
  parallelism: Parallelism;
  serviceType: ServiceType;
  parent?: string;
  blockees?: string[];
  rotation?: number;
}

interface NamespaceSeederInput {
  name: string;
  services: ServiceSeedInput[];
}

export interface NamespaceSeederOutput {
  id: number;
  name: string;
  services: Map<string, Service & { rotation: number }>;
}

export const SEEDER_INPUT_PATH = join(homedir(), SEEDER_INPUT_FILE_NAME);

export default class NamespaceSeeder implements Seeder {
  public async run(dataSource: DataSource, factoryManager: SeederFactoryManager): Promise<NamespaceSeederOutput> {
    const map: Map<string, Service & { rotation: number }> = new Map();

    const inputContent = await readFile(SEEDER_INPUT_PATH, 'utf-8');
    const seedInput = JSON.parse(inputContent) as NamespaceSeederInput;
    let remaining = seedInput.services.length;

    // seed namespace
    const namespaceFactory = factoryManager.get(Namespace);
    const { namespaceId } = await namespaceFactory.save({ name: seedInput.name });

    // seed services (the typeorm save method is used to seed the `service_closure` table) and their rotations
    const serviceFactory = factoryManager.get(Service);
    const rotationFactory = factoryManager.get(Rotation);

    while (remaining > 0) {
      for (const service of seedInput.services) {
        if (map.has(service.name) || (service.parent !== undefined && !map.has(service.parent))) {
          continue;
        }

        const savedService = await serviceFactory.save({
          namespaceId,
          name: service.name,
          parallelism: service.parallelism,
          serviceType: service.serviceType,
          parentServiceId: service.parent ?? null,
          parent: service.parent !== undefined ? map.get(service.parent) : null,
        });

        const parent = seedInput.services.find((s) => s.name === service.parent);

        const serviceRotation = service.rotation ?? INITAL_ROTATION_VALUE;
        await rotationFactory.save({
          service: savedService,
          serviceId: savedService.id,
          serviceRotation,
          parentRotation: parent !== undefined ? parent.rotation ?? INITAL_ROTATION_VALUE : null,
        });

        map.set(service.name, { ...savedService, rotation: serviceRotation });
        remaining--;

        console.log(`seeded ${service.name}`);
      }
    }

    // seed blocks
    const blockFactory = factoryManager.get(Block);

    for (const service of seedInput.services) {
      const blockerService = map.get(service.name);
      for (const blockee of service.blockees ?? []) {
        const blockeeService = map.get(blockee);
        await blockFactory.save({
          blockerId: (blockerService as Service).id,
          blockerService: blockerService,
          blockeeId: (blockeeService as Service).id,
          blockeeService: blockeeService,
        });
      }
    }

    return { id: namespaceId, name: seedInput.name, services: map };
  }
}
