import { cp } from 'fs/promises';
import { join } from 'path';
import { SEEDER_INPUT_PATH } from '../../../db/seeds/namespaceSeeder';

const EXAMPLE_SEED_PATH = join(process.cwd(), 'namespace-seeder-example.json');

export default async (): Promise<void> => {
  await cp(EXAMPLE_SEED_PATH, SEEDER_INPUT_PATH);
};
