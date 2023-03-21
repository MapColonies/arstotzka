import {
  Action,
  FlattedDetailedService,
  ActionFilter,
  LockRequest,
  ActionParams,
  UpdatableActionParams,
  ServiceAlreadyLockedError,
  ServiceNotFoundError,
  LockNotFoundError,
  ActionNotFoundError,
  ParallelismMismatchError,
  ActionAlreadyClosedError,
  ServiceUnaccessibleError,
} from '@map-colonies/vector-management-common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import axiosRetry, { exponentialDelay, IAxiosRetryConfig } from 'axios-retry';
import { StatusCodes } from 'http-status-codes';
import { MediatorConfig, MediatorOptions, Remote, RetryStrategy, DEFAULT_RETRY_STRATEGY_DELAY } from './config';
import { ILogger } from './logging';

interface IRegistryMediator {
  fetchService: (serviceId: string) => Promise<FlattedDetailedService>;
}

interface ILockyMediator {
  createLock: (lockRequest: LockRequest) => Promise<{ lockId: string }>;
  removeLock: (lockId: string) => Promise<void>;
  reserveAccess: (serviceId: string) => Promise<{ lockId: string } | undefined>;
}

interface IActionyMediator {
  filterActions: (filter: ActionFilter) => Promise<Action[]>;
  createAction: (params: ActionParams) => Promise<{ actionId: string }>;
  updateAction: (actionId: string, params: UpdatableActionParams) => Promise<void>;
}

export type IMediator = IRegistryMediator & ILockyMediator & IActionyMediator;

export class Mediator implements IMediator {
  private readonly logger: ILogger | undefined;
  private readonly config: MediatorConfig;
  private readonly client: AxiosInstance;

  public constructor(options: MediatorOptions) {
    const { logger, ...config } = options;
    this.logger = logger;
    this.config = config;
    this.client = axios.create({ timeout: options.timeout });
    if (options.enableRetryStrategy === true) {
      this.configureRetryStrategy(options.retryStrategy as RetryStrategy);
    }
  }

  public async fetchService(serviceId: string): Promise<FlattedDetailedService> {
    const remote = this.config[Remote.REGISTRY];

    if (remote === undefined) {
      throw new Error(`remote ${Remote.REGISTRY} is not configured`);
    }

    this.logger?.debug({ msg: `getting service from ${Remote.REGISTRY}`, serviceId, remote: { name: Remote.REGISTRY, ...remote } });

    try {
      const res = await this.client.get<FlattedDetailedService>(`${remote.url}/service/${serviceId}`);
      return res.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger?.error({
        msg: `failed to get service from ${Remote.REGISTRY}`,
        serviceId,
        err: axiosError,
        remote: { name: Remote.REGISTRY, ...remote },
      });

      if (axiosError.response?.status === StatusCodes.NOT_FOUND) {
        throw new ServiceNotFoundError(`service ${serviceId} not found`);
      }

      throw axiosError;
    }
  }

  public async createLock(lockRequest: LockRequest): Promise<{ lockId: string }> {
    const remote = this.config[Remote.LOCKY];

    if (remote === undefined) {
      throw new Error(`remote ${Remote.LOCKY} is not configured`);
    }

    this.logger?.debug({ msg: `posting lock to ${Remote.LOCKY}`, lockRequest, remote: { name: Remote.LOCKY, ...remote } });

    try {
      const res = await this.client.post<{ lockId: string }>(`${remote.url}/lock`, lockRequest);
      return res.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger?.error({ msg: `failed to post lock to ${Remote.LOCKY}`, lockRequest, err: axiosError, remote: { name: Remote.LOCKY, ...remote } });

      if (axiosError.response?.status === StatusCodes.CONFLICT) {
        throw new ServiceAlreadyLockedError(`could not lock at least one of requested services due to nonexpired lock`);
      }

      throw axiosError;
    }
  }

  public async removeLock(lockId: string): Promise<void> {
    const remote = this.config[Remote.LOCKY];

    if (remote === undefined) {
      throw new Error(`remote ${Remote.LOCKY} is not configured`);
    }

    this.logger?.debug({ msg: `deleting lock from ${Remote.LOCKY}`, lockId, remote: { name: Remote.LOCKY, ...remote } });

    try {
      await this.client.delete(`${remote.url}/lock/${lockId}`);
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger?.error({ msg: `failed to delete lock from ${Remote.LOCKY}`, lockId, err: axiosError, remote: { name: Remote.LOCKY, ...remote } });

      if (axiosError.response?.status === StatusCodes.NOT_FOUND) {
        throw new LockNotFoundError(`lock ${lockId} not found`);
      }

      throw axiosError;
    }
  }

  public async reserveAccess(serviceId: string): Promise<{ lockId: string } | undefined> {
    const remote = this.config[Remote.LOCKY];

    if (remote === undefined) {
      throw new Error(`remote ${Remote.LOCKY} is not configured`);
    }

    this.logger?.debug({ msg: `reserving access on ${Remote.LOCKY}`, serviceId, remote: { name: Remote.LOCKY, ...remote } });

    try {
      const res = await this.client.post<{ lockId: string } | undefined>(`${remote.url}/lock/reserve`, undefined, { params: { serviceId } });
      return res.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger?.error({
        msg: `failed to reserve access on ${Remote.LOCKY}`,
        serviceId,
        err: axiosError,
        remote: { name: Remote.LOCKY, ...remote },
      });

      if (axiosError.response?.status === StatusCodes.NOT_FOUND) {
        throw new ServiceNotFoundError(`service ${serviceId} not found`);
      } else if (axiosError.response?.status === StatusCodes.CONFLICT) {
        throw new ServiceUnaccessibleError(`could not reserve access for service ${serviceId}`);
      }

      throw axiosError;
    }
  }

  public async filterActions(filter: ActionFilter): Promise<Action[]> {
    const remote = this.config[Remote.ACTIONY];

    if (remote === undefined) {
      throw new Error(`remote ${Remote.ACTIONY} is not configured`);
    }

    this.logger?.debug({ msg: `getting actions from ${Remote.ACTIONY}`, filter, remote: { name: Remote.ACTIONY, ...remote } });

    try {
      const res = await this.client.get<Action[]>(`${remote.url}/action`, { params: filter });
      return res.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger?.error({
        msg: `failed to get actions from ${Remote.ACTIONY}`,
        filter,
        err: axiosError,
        remote: { name: Remote.ACTIONY, ...remote },
      });

      throw axiosError;
    }
  }

  public async createAction(params: ActionParams): Promise<{ actionId: string }> {
    const remote = this.config[Remote.ACTIONY];

    if (remote === undefined) {
      throw new Error(`remote ${Remote.ACTIONY} is not configured`);
    }

    this.logger?.debug({ msg: `posting action to ${Remote.ACTIONY}`, params, remote: { name: Remote.ACTIONY, ...remote } });

    try {
      const res = await this.client.post<{ actionId: string }>(`${remote.url}/action`, params);
      return res.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger?.error({ msg: `failed to post action to ${Remote.ACTIONY}`, params, err: axiosError, remote: { name: Remote.ACTIONY, ...remote } });

      if (axiosError.response?.status === StatusCodes.NOT_FOUND) {
        throw new ServiceNotFoundError(`service ${params.serviceId} not found`);
      } else if (axiosError.response?.status === StatusCodes.CONFLICT) {
        throw new ParallelismMismatchError(`service ${params.serviceId} has mismatched parallelism`);
      }

      throw axiosError;
    }
  }

  public async updateAction(actionId: string, params: UpdatableActionParams): Promise<void> {
    const remote = this.config[Remote.ACTIONY];

    if (remote === undefined) {
      throw new Error(`remote ${Remote.ACTIONY} is not configured`);
    }

    this.logger?.debug({ msg: `posting action to ${Remote.ACTIONY}`, params, remote: { name: Remote.ACTIONY, ...remote } });

    try {
      await this.client.patch(`${remote.url}/action/${actionId}`, params);
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger?.error({
        msg: `failed to patch action on ${Remote.ACTIONY}`,
        actionId,
        params,
        err: axiosError,
        remote: { name: Remote.ACTIONY, ...remote },
      });

      if (axiosError.response?.status === StatusCodes.NOT_FOUND) {
        throw new ActionNotFoundError(`action ${actionId} not found`);
      } else if (axiosError.response?.status === StatusCodes.CONFLICT) {
        throw new ActionAlreadyClosedError(`action ${actionId} has already been closed`);
      }

      throw axiosError;
    }
  }

  private configureRetryStrategy(retryStrategy: RetryStrategy): void {
    const config: IAxiosRetryConfig = {
      retries: retryStrategy.retries,
      shouldResetTimeout: retryStrategy.shouldResetTimeout,
      retryDelay: retryStrategy.isExponential === true ? exponentialDelay : (): number => retryStrategy.delay ?? DEFAULT_RETRY_STRATEGY_DELAY,
      onRetry: (retryCount, error, requestConfig) => {
        this.logger?.warn({ msg: `retrying request`, retryStrategy, retryCount, err: error, requestConfig });
      },
    };

    axiosRetry(this.client, config);
  }
}
