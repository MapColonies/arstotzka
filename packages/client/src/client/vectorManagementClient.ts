import { Action, FlattedDetailedService, ServiceNotRecognizedByRegistry, ActionFilter } from '@map-colonies/vector-management-common';
import axios, { AxiosError } from 'axios';
import { StatusCodes } from 'http-status-codes';
import { ILogger } from './logging';

interface ApiOptions {
  endpoint: string;
}

interface ClientConfig {
  actiony?: ApiOptions;
  registry?: ApiOptions;
  locky?: ApiOptions;
}

export interface ClientOptions extends ClientConfig {
  logger?: ILogger;
  timeout?: number;
}

export class VectorManagementClient {
  private readonly logger: ILogger | undefined;
  private readonly config: ClientConfig;

  public constructor(options: ClientOptions) {
    const { logger, ...config } = options;
    this.logger = logger;
    this.config = config;
  }

  public async getService(serviceId: string): Promise<FlattedDetailedService> {
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

  public async getActions(filter: ActionFilter): Promise<Action[]> {
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
}
