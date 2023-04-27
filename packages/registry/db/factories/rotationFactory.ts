import { setSeederFactory } from 'typeorm-extension';
import { Rotation } from '../../src/service/DAL/typeorm/rotation';

export default setSeederFactory(Rotation, () => {
  const rotation = new Rotation();
  return rotation;
});
