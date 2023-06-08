import { setSeederFactory } from 'typeorm-extension';
import { Block } from '../../src/service/DAL/typeorm/block';

export default setSeederFactory(Block, () => {
  const block = new Block();
  return block;
});
