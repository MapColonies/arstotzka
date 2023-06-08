import { ILogger } from './logging';

type MediatorRemotesConfig = {
  [key in Remote]?: RemoteOptions;
};

export interface RemoteOptions {
  url: string;
}

export enum Remote {
  REGISTRY = 'registry',
  LOCKY = 'locky',
  ACTIONY = 'actiony',
}

export const DEFAULT_RETRY_STRATEGY_DELAY = 0;

export interface RetryStrategy {
  retries?: number;
  shouldResetTimeout?: boolean;
  isExponential?: boolean;
  delay?: number;
}

export interface MediatorClientConfig {
  timeout?: number;
  enableRetryStrategy?: boolean;
  retryStrategy?: RetryStrategy;
}

export type MediatorConfig = MediatorRemotesConfig & MediatorClientConfig;

export interface MediatorOptions extends MediatorConfig {
  logger?: ILogger;
}
