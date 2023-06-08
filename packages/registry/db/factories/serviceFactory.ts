import { Parallelism, ServiceType } from '@map-colonies/arstotzka-common';
import { setSeederFactory } from 'typeorm-extension';
import { Service } from '../../src/service/DAL/typeorm/service';

export default setSeederFactory(Service, (faker) => {
  const service = new Service();
  service.namespaceId = faker.datatype.number();
  service.name = faker.name.firstName();
  service.parallelism = Parallelism.SINGLE;
  service.serviceType = ServiceType.CONSUMER;
  service.parentServiceId = null;
  service.parent = null;
  return service;
});
