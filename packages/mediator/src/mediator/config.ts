import { ILogger } from './logging';

interface RemoteOptions {
  url: string;
}

type MediatorRemotesConfig = {
  [key in Remote]?: RemoteOptions;
};

export enum Remote {
  REGISTRY = 'registry',
  LOCKY = 'locky',
  ACTIONY = 'actiony',
}

// TODO: add axios-retry options
export interface MediatorConfig extends MediatorRemotesConfig {
  timeout?: number;
}

export interface MediatorOptions extends MediatorConfig {
  logger?: ILogger;
}
