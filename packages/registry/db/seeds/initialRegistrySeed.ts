import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Parallelism, ServiceType } from '@map-colonies/arstotzka-common';
import { Namespace } from '../../src/service/DAL/typeorm/namespace';
import { Service } from '../../src/service/DAL/typeorm/service';
import { Block } from '../../src/service/DAL/typeorm/block';
import { Rotation } from '../../src/service/DAL/typeorm/rotation';

const buildNamespace = (name: string): Namespace => {
  const namespace = new Namespace();
  namespace.name = name;
  return namespace;
};

const buildService = (
  namespaceId: number,
  name: string,
  parallelism: Parallelism,
  serviceType: ServiceType,
  parent: Service | null = null
): Service => {
  const service = new Service();
  service.namespaceId = namespaceId;
  service.name = name;
  service.parallelism = parallelism;
  service.serviceType = serviceType;
  service.parentServiceId = parent ? parent.id : null;
  service.parent = parent;
  return service;
};

const buildBlock = (blocker: Service, blockee: Service): Block => {
  const block = new Block();
  block.blockerId = blocker.id;
  block.blockerService = blocker;
  block.blockeeId = blockee.id;
  block.blockeeService = blockee;
  return block;
};

const buildRotation = (service: Service): Rotation => {
  const rotation = new Rotation();
  rotation.service = service;
  rotation.serviceId = service.id;
  rotation.serviceRotation = 1;
  rotation.parentRotation = service.parentServiceId !== null ? 1 : null;
  return rotation;
};

export default class InitailRegistrySeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<void> {
    // seed namespace
    const insertResult = await dataSource.manager.insert(Namespace, buildNamespace('main'));
    const namespaceId = insertResult.identifiers[0].namespaceId as number;

    // seed services (the typeorm save method is used to seed the `service_closure` table)
    await dataSource.manager.save(Service, buildService(namespaceId, 'ingestion', Parallelism.MULTIPLE, ServiceType.PRODUCER));
    const ingestion = (await dataSource.manager.findOne(Service, { where: { namespaceId, name: 'ingestion' } })) as Service;

    await dataSource.manager.save(Service, buildService(namespaceId, 'osmdbt', Parallelism.SINGLE, ServiceType.PRODUCER));
    const osmdbt = (await dataSource.manager.findOne(Service, { where: { namespaceId, name: 'osmdbt' } })) as Service;

    await dataSource.manager.save(Service, buildService(namespaceId, 'osm2pg-rendering', Parallelism.SINGLE, ServiceType.CONSUMER, osmdbt));
    const osm2pgRendering = (await dataSource.manager.findOne(Service, { where: { namespaceId, name: 'osm2pg-rendering' } })) as Service;

    await dataSource.manager.save(Service, buildService(namespaceId, 'rendering', Parallelism.MULTIPLE, ServiceType.CONSUMER, osm2pgRendering));
    const rendering = (await dataSource.manager.findOne(Service, { where: { namespaceId, name: 'rendering' } })) as Service;

    await dataSource.manager.save(Service, buildService(namespaceId, 'osm2pg-query', Parallelism.SINGLE, ServiceType.CONSUMER, osmdbt));
    const osm2pgQuery = (await dataSource.manager.findOne(Service, { where: { namespaceId, name: 'osm2pg-query' } })) as Service;

    await dataSource.manager.save(Service, buildService(namespaceId, 'planet-dumper', Parallelism.SINGLE, ServiceType.CONSUMER, osmdbt));
    const planetDumper = (await dataSource.manager.findOne(Service, { where: { namespaceId, name: 'planet-dumper' } })) as Service;

    // seed blocks
    await dataSource.manager.insert(Block, [
      buildBlock(ingestion, planetDumper),
      buildBlock(planetDumper, ingestion),
      buildBlock(osmdbt, planetDumper),
      buildBlock(planetDumper, osmdbt),
    ]);

    // seed rotations
    await dataSource.manager.insert(
      Rotation,
      [ingestion, osmdbt, osm2pgRendering, rendering, osm2pgQuery, planetDumper].map((service) => buildRotation(service))
    );
  }
}
