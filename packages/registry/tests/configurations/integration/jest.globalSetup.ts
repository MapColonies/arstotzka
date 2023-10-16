import { cp } from 'fs/promises';
import { join } from 'path';
import { SEEDER_INPUT_PATH } from '../../../db/seeds/namespaceSeeder';

const SEED_PATH = join(process.cwd(), 'db', 'seeds', 'examples', 'namespace-create-example.json');

export default async (): Promise<void> => {
  await cp(SEED_PATH, SEEDER_INPUT_PATH);
};
