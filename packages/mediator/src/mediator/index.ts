import { Action, FlattedDetailedService, ServiceNotRecognizedByRegistry, ActionFilter } from '@map-colonies/vector-management-common';
import { LockRequest } from '@map-colonies/vector-management-common/src/types/locky';
import axios, { AxiosError } from 'axios';
import { StatusCodes } from 'http-status-codes';
import { ILogger } from './logging';

interface ApiOptions {
  endpoint: string;
}

interface MediatorConfig {
  actiony?: ApiOptions;
  registry?: ApiOptions;
  locky?: ApiOptions;
}

export interface MediatorOptions extends MediatorConfig {
  logger?: ILogger;
  timeout?: number;
}

export interface IMediator {
  fetchService: (serviceId: string) => Promise<FlattedDetailedService>;
  filterActions: (filter: ActionFilter) => Promise<Action[]>;
  createLock: (lockRequest: LockRequest) => Promise<{ lockId: string }>;
  removeLock: (lockId: string) => Promise<void>;
}

export class Mediator implements IMediator {
  private readonly logger: ILogger | undefined;
  private readonly config: MediatorConfig;

  public constructor(options: MediatorOptions) {
    const { logger, ...config } = options;
    this.logger = logger;
    this.config = config;
  }

  // TODO: should error handling be done here or in the service?
  public async fetchService(serviceId: string): Promise<FlattedDetailedService> {
    this.logger?.debug({ msg: `getting service from registry`, serviceId, registry: this.config.registry });

    try {
      const res = await axios.get<FlattedDetailedService>(`${this.config.registry?.endpoint as string}/service/${serviceId}`);
      return res.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger?.error({ msg: `failed to get service from registry`, serviceId, err: axiosError, registry: this.config.registry });

      if (axiosError.response?.status === StatusCodes.NOT_FOUND) {
        throw new ServiceNotRecognizedByRegistry(`could not recognize service ${serviceId} on registry`);
      }

      throw axiosError;
    }
  }

  public async filterActions(filter: ActionFilter): Promise<Action[]> {
    this.logger?.debug({ msg: `getting actions from actiony`, filter, actiony: this.config.actiony });

    try {
      const res = await axios.get<Action[]>(`${this.config.actiony?.endpoint as string}/action`, { params: filter });
      return res.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger?.error({ msg: `failed to get actions from actiony`, filter, err: axiosError, actiony: this.config.actiony });

      throw axiosError;
    }
  }

  public async createLock(lockRequest: LockRequest): Promise<{ lockId: string }> {
    this.logger?.debug({ msg: `posting lock to locky`, lockRequest, locky: this.config.locky });

    try {
      const res = await axios.post<{ lockId: string }>(`${this.config.locky?.endpoint as string}/lock`, lockRequest);
      return res.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger?.error({ msg: `failed to post lock to locky`, lockRequest, err: axiosError, locky: this.config.locky });

      throw axiosError;
    }
  }

  public async removeLock(lockId: string): Promise<void> {
    this.logger?.debug({ msg: `deleting lock from locky`, lockId, locky: this.config.locky });

    try {
      await axios.delete(`${this.config.locky?.endpoint as string}/lock/${lockId}`);
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger?.error({ msg: `failed to delete lock from locky`, lockId, err: axiosError, locky: this.config.locky });

      throw axiosError;
    }
  }
}
