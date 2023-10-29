import { homedir } from 'os';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { DataSource, QueryRunner } from 'typeorm';
import { Parallelism, ServiceType } from '@map-colonies/arstotzka-common';
import { Namespace } from '../../src/service/DAL/typeorm/namespace';
import { Service } from '../../src/service/DAL/typeorm/service';
import { Block } from '../../src/service/DAL/typeorm/block';
import { Rotation } from '../../src/service/DAL/typeorm/rotation';

let queryRunner: QueryRunner;
let remaining = 0;

const SEEDER_INPUT_FILE_NAME = 'arstotzka-namespace-seeder.json';

const INITAL_ROTATION_VALUE = 1;

type ActionType = 'create' | 'modify' | 'delete';

interface ServiceDeleteInput {
  name: string;
  action: 'delete';
}

interface ServiceCreateInput {
  name: string;
  action: 'create';
  parallelism: Parallelism;
  serviceType: ServiceType;
  parent?: string;
  blockees?: string[];
  rotation?: number;
}

interface ServiceModifyInput {
  name: string;
  action: ActionType;
  parallelism?: Parallelism;
  serviceType?: ServiceType;
  blockees?: string[];
}

type ServiceSeedInput = ServiceCreateInput | ServiceModifyInput | ServiceDeleteInput;

interface NamespaceSeederInput<T = ServiceSeedInput> {
  name: string;
  action: ActionType;
  services?: T[];
}

const deleteService = async (queryRunner: QueryRunner, service: Service): Promise<void> => {
  const serviceRepo = queryRunner.manager.getRepository(Service);

  const serviceWithChildren = await serviceRepo
    .createQueryBuilder('service')
    .leftJoinAndSelect('service.children', 'children')
    .where('service.id = :id', { id: service.id })
    .getOneOrFail();

  for (const child of serviceWithChildren.children) {
    await deleteService(queryRunner, child);
  }

  await serviceRepo.delete({ id: service.id });

  remaining--;

  console.log(`deleted service ${service.name}`);
};

const deleteNamespace = async (queryRunner: QueryRunner, seedInput: NamespaceSeederInput<ServiceDeleteInput>): Promise<NamespaceSeederOutput> => {
  const namespaceRepo = queryRunner.manager.getRepository(Namespace);
  await namespaceRepo.delete({ name: seedInput.name });

  console.log(`deleted namespace ${seedInput.name}`);

  return { id: -1, name: seedInput.name, services: new Map() };
};

const createNamespace = async (queryRunner: QueryRunner, seedInput: NamespaceSeederInput<ServiceCreateInput>): Promise<NamespaceSeederOutput> => {
  const map: Map<string, Service & { rotation: number }> = new Map();
  remaining = seedInput.services ? seedInput.services.length : 0;

  // seed namespace
  const namespaceRepo = queryRunner.manager.getRepository(Namespace);
  const serviceRepo = queryRunner.manager.getRepository(Service);
  const rotationRepo = queryRunner.manager.getRepository(Rotation);
  const blockeRepo = queryRunner.manager.getRepository(Block);

  const existingNamespace = await namespaceRepo.findOne({ where: { name: seedInput.name } });

  if (existingNamespace !== null) {
    console.warn(`namespace ${seedInput.name} already exists`);
  }

  const { namespaceId } = await namespaceRepo.save({ name: seedInput.name });

  // seed services (the typeorm save method is used to seed the `service_closure` table) and their rotations
  while (remaining > 0) {
    for (const service of seedInput.services ?? []) {
      if (map.has(service.name) || (service.parent !== undefined && !map.has(service.parent))) {
        continue;
      }

      const savedService = await serviceRepo.save({
        namespaceId,
        name: service.name,
        parallelism: service.parallelism,
        serviceType: service.serviceType,
        parentServiceId: service.parent ?? null,
        parent: service.parent !== undefined ? map.get(service.parent) : null,
      });

      const parent = seedInput.services?.find((s) => s.name === service.parent);

      const serviceRotation = service.rotation ?? INITAL_ROTATION_VALUE;
      await rotationRepo.save({
        service: savedService,
        serviceId: savedService.id,
        serviceRotation,
        parentRotation: parent !== undefined ? parent.rotation ?? INITAL_ROTATION_VALUE : null,
      });

      map.set(service.name, { ...savedService, rotation: serviceRotation });
      remaining--;

      console.log(`created service ${service.name}`);
    }
  }

  // seed blocks
  for (const service of seedInput.services ?? []) {
    const blockerService = map.get(service.name) as Service;
    for (const blockee of service.blockees ?? []) {
      const blockeeService = map.get(blockee) as Service;
      await blockeRepo.save({
        blockerId: blockerService.id,
        blockerService: blockerService,
        blockeeId: blockeeService.id,
        blockeeService: blockeeService,
      });

      console.log(`created block ${blockerService.name} on ${blockeeService.name}`);
    }
  }

  return { id: namespaceId, name: seedInput.name, services: map };
};

const modifyNamespace = async (queryRunner: QueryRunner, seedInput: NamespaceSeederInput<ServiceModifyInput>): Promise<NamespaceSeederOutput> => {
  const map: Map<string, Service & { rotation: number }> = new Map();

  const namespaceRepo = queryRunner.manager.getRepository(Namespace);
  const serviceRepo = queryRunner.manager.getRepository(Service);
  const rotationRepo = queryRunner.manager.getRepository(Rotation);
  const blockRepo = queryRunner.manager.getRepository(Block);

  const namespace = await namespaceRepo.findOneOrFail({ where: { name: seedInput.name } });

  const deletions = seedInput.services?.filter((service) => service.action === 'delete') as ServiceDeleteInput[] | undefined;
  for (const service of deletions ?? []) {
    const serviceToDelete = await serviceRepo.findOneOrFail({ where: { namespaceId: namespace.namespaceId, name: service.name } });
    await deleteService(queryRunner, serviceToDelete);
  }

  const creations = seedInput.services?.filter((service) => service.action === 'create') as ServiceCreateInput[];
  for await (const service of creations) {
    const serviceToCreate = await serviceRepo.findOne({ where: { namespaceId: namespace.namespaceId, name: service.name } });
    if (serviceToCreate !== null || map.has(service.name)) {
      continue;
    }

    let parent: (Service & { rotation: number }) | null = null;
    let parentRotation: number | null = null;

    if (service.parent !== undefined && map.has(service.parent)) {
      parent = map.get(service.parent) as Service & { rotation: number };
      parentRotation = parent.rotation;
    }

    if (service.parent !== undefined && !map.has(service.parent)) {
      const foundParent = await serviceRepo.findOneOrFail({ where: { namespaceId: namespace.namespaceId, name: service.parent } });

      parentRotation = (await rotationRepo.find({ where: { serviceId: foundParent.id }, order: { serviceRotation: 'desc' }, take: 1 }))[0]
        .serviceRotation;
      parent = { ...foundParent, rotation: parentRotation };
    }

    const savedService = await serviceRepo.save({
      namespaceId: namespace.namespaceId,
      name: service.name,
      parallelism: service.parallelism,
      serviceType: service.serviceType,
      parentServiceId: parent?.parentServiceId ?? null,
      parent,
    });

    await rotationRepo.save({
      service: savedService,
      serviceId: savedService.id,
      serviceRotation: service.rotation ?? INITAL_ROTATION_VALUE,
      parentRotation,
    });

    console.log(`created service ${service.name}`);
  }

  const modifications = seedInput.services?.filter((service) => service.action === 'modify') as ServiceModifyInput[];
  for await (const service of modifications) {
    if (service.parallelism === undefined && service.serviceType === undefined) {
      continue;
    }

    const fectchedService = await serviceRepo.findOneOrFail({ where: { namespaceId: namespace.namespaceId, name: service.name } });
    await serviceRepo.update(fectchedService.id, {
      parallelism: service.parallelism ?? fectchedService.parallelism,
      serviceType: service.serviceType ?? fectchedService.serviceType,
    });

    console.log(`modified service ${service.name}`);
  }

  // create blocks for newly created and modified services
  for await (const service of [...creations, ...modifications]) {
    const blockerService = await serviceRepo.findOneOrFail({ where: { namespaceId: namespace.namespaceId, name: service.name } });

    for (const blockee of service.blockees ?? []) {
      const blockeeService = await serviceRepo.findOneOrFail({ where: { namespaceId: namespace.namespaceId, name: blockee } });

      const existingBlock = await blockRepo.findOne({ where: { blockerId: blockerService.id, blockeeId: blockeeService.id } });

      if (existingBlock === null) {
        await blockRepo.save({
          blockerId: blockerService.id,
          blockerService: blockerService,
          blockeeId: blockeeService.id,
          blockeeService: blockeeService,
        });

        console.log(`created block ${blockerService.name} on ${blockeeService.name}`);
      }
    }
  }

  return { id: namespace.namespaceId, name: seedInput.name, services: new Map() };
};

export interface NamespaceSeederOutput {
  id: number;
  name: string;
  services: Map<string, Service & { rotation: number }>;
}

export const SEEDER_INPUT_PATH = join(homedir(), SEEDER_INPUT_FILE_NAME);

export default class NamespaceSeeder implements Seeder {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async run(dataSource: DataSource, factoryManager: SeederFactoryManager): Promise<NamespaceSeederOutput> {
    const inputContent = await readFile(SEEDER_INPUT_PATH, 'utf-8');
    const seedInput = JSON.parse(inputContent) as NamespaceSeederInput;

    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let result: NamespaceSeederOutput;

    try {
      switch (seedInput.action) {
        case 'create':
          result = await createNamespace(queryRunner, seedInput as NamespaceSeederInput<ServiceCreateInput>);
          break;
        case 'modify':
          result = await modifyNamespace(queryRunner, seedInput as NamespaceSeederInput<ServiceModifyInput>);
          break;
        case 'delete':
          result = await deleteNamespace(queryRunner, seedInput as NamespaceSeederInput<ServiceDeleteInput>);
          break;
        default:
          throw new Error(`unknown action`);
      }

      await queryRunner.commitTransaction();
      await queryRunner.release();
      return result;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }
}
