import { setSeederFactory } from 'typeorm-extension';
import { Namespace } from '../../src/service/DAL/typeorm/namespace';

export default setSeederFactory(Namespace, (faker) => {
  const namespace = new Namespace();
  namespace.name = faker.name.firstName();
  return namespace;
});
