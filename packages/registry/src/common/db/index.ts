import { readFileSync } from 'fs';
import { HealthCheck } from '@godaddy/terminus';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';
import { DependencyContainer, FactoryFunction } from 'tsyringe';
import { DbConfig, IConfig } from '../interfaces';
import { promiseTimeout } from '../util';
import { Service } from '../../service/DAL/typeorm/service';
import { Namespace } from '../../service/DAL/typeorm/namespace';
import { SERVICES } from '../constants';
import { Rotation } from '../../service/DAL/typeorm/rotation';
import { Block } from '../../service/DAL/typeorm/block';

let connectionSingleton: DataSource | undefined;

const DB_TIMEOUT = 5000;

export const DATA_SOURCE_PROVIDER = Symbol('dataSourceProvider');

export const DB_ENTITIES = [Namespace, Service, Rotation, Block];

export const createDataSourceOptions = (dbConfig: DbConfig): DataSourceOptions => {
  const { enableSslAuth, sslPaths, ...connectionOptions } = dbConfig;
  if (enableSslAuth && connectionOptions.type === 'postgres') {
    connectionOptions.password = undefined;
    connectionOptions.ssl = { key: readFileSync(sslPaths.key), cert: readFileSync(sslPaths.cert), ca: readFileSync(sslPaths.ca) };
  }
  return { entities: [...DB_ENTITIES, '**/DAL/*.js'], ...connectionOptions, ...seederOptions };
};

export const initDataSource = async (dbConfig: DbConfig): Promise<DataSource> => {
  if (connectionSingleton === undefined || !connectionSingleton.isInitialized) {
    connectionSingleton = new DataSource(createDataSourceOptions(dbConfig));
    await connectionSingleton.initialize();
  }
  return connectionSingleton;
};

export const getDbHealthCheckFunction = (connection: DataSource): HealthCheck => {
  return async (): Promise<void> => {
    const check = connection.query('SELECT 1').then(() => {
      return;
    });
    return promiseTimeout<void>(DB_TIMEOUT, check);
  };
};

export const dataSourceFactory: FactoryFunction<DataSource> = (container: DependencyContainer): DataSource => {
  const config = container.resolve<IConfig>(SERVICES.CONFIG);
  const dbConfig = config.get<DbConfig>('db');
  const dataSourceOptions = createDataSourceOptions(dbConfig);
  return new DataSource(dataSourceOptions);
};

export const seederOptions: SeederOptions = {
  seeds: ['db/seeds/**/*{.ts,.js}'],
  factories: ['db/factories/**/*{.ts,.js}'],
};
