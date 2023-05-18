import nock from 'nock';
import { HttpStatusCode, AxiosError } from 'axios';
import {
  ActionAlreadyClosedError,
  ActionFilter,
  ActionNotFoundError,
  ActionParams,
  ActionStatus,
  LockNotFoundError,
  LockRequest,
  ParallelismMismatchError,
  ServiceAlreadyLockedError,
  ServiceNotFoundError,
  ServiceUnaccessibleError,
  UpdatableActionParams,
} from '@map-colonies/arstotzka-common';
import { Mediator } from '../../src';
import { Remote } from '../../src/mediator/config';
import { MockUrl } from './helpers';

describe('Mediator', () => {
  let mediator: Mediator;
  let getSpy: jest.SpyInstance<unknown>;
  let postSpy: jest.SpyInstance<unknown>;
  let patchSpy: jest.SpyInstance<unknown>;
  let deleteSpy: jest.SpyInstance<unknown>;

  beforeAll(() => {
    mediator = new Mediator({ registry: { url: MockUrl.REGISTRY }, locky: { url: MockUrl.LOCKY }, actiony: { url: MockUrl.ACTIONY } });
    getSpy = jest.spyOn(mediator['client'], 'get');
    postSpy = jest.spyOn(mediator['client'], 'post');
    patchSpy = jest.spyOn(mediator['client'], 'patch');
    deleteSpy = jest.spyOn(mediator['client'], 'delete');
  });

  beforeEach(() => {
    jest.resetAllMocks();
    nock.cleanAll();
  });

  describe('#fetchService', () => {
    it('should http get the requested service', async function () {
      const serviceId = 'serviceId';
      const service = { k: 'v' };
      nock(MockUrl.REGISTRY).get(`/service/${serviceId}`).reply(HttpStatusCode.Ok, service);

      const response = await mediator.fetchService(serviceId);

      expect(response).toMatchObject(service);
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith(`${MockUrl.REGISTRY}/service/${serviceId}`);
    });

    it('should throw a serviceNotFoundError if the requested service is not found', async function () {
      const serviceId = 'serviceId';
      const error = new ServiceNotFoundError(`service ${serviceId} not found`);
      nock(MockUrl.REGISTRY).get(`/service/${serviceId}`).reply(HttpStatusCode.NotFound);

      await expect(mediator.fetchService(serviceId)).rejects.toThrow(error);
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith(`${MockUrl.REGISTRY}/service/${serviceId}`);
    });

    it('should throw an error if the http get request has errored', async function () {
      const serviceId = 'serviceId';
      nock(MockUrl.REGISTRY).get(`/service/${serviceId}`).reply(HttpStatusCode.InternalServerError);

      await expect(mediator.fetchService(serviceId)).rejects.toThrow(AxiosError);
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith(`${MockUrl.REGISTRY}/service/${serviceId}`);
    });
  });

  describe('#createLock', () => {
    it('should http post the lockRequest and return the created lock', async function () {
      const lock = { lockId: 'lockId' };
      const lockRequest: LockRequest = { services: ['serviceId'], expiration: 100, reason: 'reason' };
      nock(MockUrl.LOCKY).post(`/lock`).reply(HttpStatusCode.Created, lock);

      const response = await mediator.createLock(lockRequest);

      expect(response).toMatchObject(lock);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(`${MockUrl.LOCKY}/lock`, lockRequest);
    });

    it('should throw a serviceAlreadyLockedError if the one of the requested services is already locked', async function () {
      const error = new ServiceAlreadyLockedError(`could not lock at least one of requested services due to nonexpired lock`);
      const lockRequest: LockRequest = { services: ['serviceId'], expiration: 100, reason: 'reason' };
      nock(MockUrl.LOCKY).post(`/lock`).reply(HttpStatusCode.Conflict);

      await expect(mediator.createLock(lockRequest)).rejects.toThrow(error);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(`${MockUrl.LOCKY}/lock`, lockRequest);
    });

    it('should throw an error if http post has errored', async function () {
      const lockRequest: LockRequest = { services: ['serviceId'], expiration: 100, reason: 'reason' };
      nock(MockUrl.LOCKY).post(`/lock`).reply(HttpStatusCode.InternalServerError);

      await expect(mediator.createLock(lockRequest)).rejects.toThrow(AxiosError);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(`${MockUrl.LOCKY}/lock`, lockRequest);
    });
  });

  describe('#removeLock', () => {
    it('should http delete the lock id', async function () {
      const lockId = 'lockId';
      nock(MockUrl.LOCKY).delete(`/lock/${lockId}`).reply(HttpStatusCode.NoContent);

      await expect(mediator.removeLock(lockId)).resolves.toBeUndefined();
      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith(`${MockUrl.LOCKY}/lock/${lockId}`);
    });

    it('should throw a lockNotFoundError if http delete request returns not found', async function () {
      const lockId = 'lockId';
      const error = new LockNotFoundError(`lock ${lockId} not found`);
      nock(MockUrl.LOCKY).delete(`/lock/${lockId}`).reply(HttpStatusCode.NotFound);

      await expect(mediator.removeLock(lockId)).rejects.toThrow(error);
      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith(`${MockUrl.LOCKY}/lock/${lockId}`);
    });

    it('should throw an error if http delete has errored', async function () {
      const lockId = 'lockId';
      nock(MockUrl.LOCKY).post(`/lock`).reply(HttpStatusCode.InternalServerError);

      await expect(mediator.removeLock(lockId)).rejects.toThrow(AxiosError);
      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith(`${MockUrl.LOCKY}/lock/${lockId}`);
    });
  });

  describe('#reserveAccess', () => {
    it('should http post the service to be reserved and return the created lock', async function () {
      const serviceId = 'serviceId';
      const lock = { lockId: 'lockId' };
      nock(MockUrl.LOCKY).post(`/lock/reserve`).query({ service: serviceId }).reply(HttpStatusCode.Created, lock);

      const response = await mediator.reserveAccess(serviceId);

      expect(response).toMatchObject(lock);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(`${MockUrl.LOCKY}/lock/reserve`, undefined, { params: { service: serviceId } });
    });

    it('should throw a serviceNotFoundError if http post request returns not found', async function () {
      const serviceId = 'serviceId';
      const error = new ServiceNotFoundError(`service ${serviceId} not found`);
      nock(MockUrl.LOCKY).post(`/lock/reserve`).query({ service: serviceId }).reply(HttpStatusCode.NotFound);

      await expect(mediator.reserveAccess(serviceId)).rejects.toThrow(error);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(`${MockUrl.LOCKY}/lock/reserve`, undefined, { params: { service: serviceId } });
    });

    it('should throw a serviceUnaccessibleError if http post request returns conflict', async function () {
      const serviceId = 'serviceId';
      const error = new ServiceUnaccessibleError(`could not reserve access for service ${serviceId}`);
      nock(MockUrl.LOCKY).post(`/lock/reserve`).query({ service: serviceId }).reply(HttpStatusCode.Conflict);

      await expect(mediator.reserveAccess(serviceId)).rejects.toThrow(error);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(`${MockUrl.LOCKY}/lock/reserve`, undefined, { params: { service: serviceId } });
    });

    it('should throw an error if http post has errored', async function () {
      const serviceId = 'serviceId';
      nock(MockUrl.LOCKY).post(`/lock/reserve`).query({ service: serviceId }).reply(HttpStatusCode.InternalServerError);

      await expect(mediator.reserveAccess(serviceId)).rejects.toThrow(AxiosError);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(`${MockUrl.LOCKY}/lock/reserve`, undefined, { params: { service: serviceId } });
    });
  });

  describe('#filterActions', () => {
    it('should http get actions according to filter from actiony', async function () {
      const serviceId = 'serviceId';
      const filter: ActionFilter = { service: serviceId, limit: 3, sort: 'desc' };
      const actions = [{ k: 'v' }];
      nock(MockUrl.ACTIONY)
        .get(`/action`)
        .query({ ...filter })
        .reply(HttpStatusCode.Ok, actions);

      const response = await mediator.filterActions(filter);

      expect(response).toMatchObject(actions);
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith(`${MockUrl.ACTIONY}/action`, { params: filter });
    });

    it('should http get actions according to filter from override remote', async function () {
      const override = 'http://override.com';
      const serviceId = 'serviceId';
      const filter: ActionFilter = { service: serviceId, limit: 3, sort: 'desc' };
      const actions = [{ k: 'v' }];
      nock(override)
        .get('/')
        .query({ ...filter })
        .reply(HttpStatusCode.Ok, actions);

      const response = await mediator.filterActions(filter, { url: override });

      expect(response).toMatchObject(actions);
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith(override, { params: filter });
    });

    it('should throw an error if http get has errored', async function () {
      const serviceId = 'serviceId';
      const filter: ActionFilter = { service: serviceId, limit: 3, sort: 'desc' };
      nock(MockUrl.ACTIONY)
        .get(`/action`)
        .query({ ...filter })
        .reply(HttpStatusCode.InternalServerError);

      await expect(mediator.filterActions(filter)).rejects.toThrow(AxiosError);
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith(`${MockUrl.ACTIONY}/action`, { params: filter });
    });
  });

  describe('#createAction', () => {
    it('should http post action with given params', async function () {
      const actionId = { actionId: 'actionId' };
      const params: ActionParams = { serviceId: 'serviceId', state: 1 };
      nock(MockUrl.ACTIONY).post(`/action`).reply(HttpStatusCode.Created, actionId);

      const response = await mediator.createAction(params);

      expect(response).toMatchObject(actionId);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(`${MockUrl.ACTIONY}/action`, params);
    });

    it('should throw serviceNotFoundError if http get returns not found', async function () {
      const params: ActionParams = { serviceId: 'serviceId', state: 1 };
      const error = new ServiceNotFoundError(`service ${params.serviceId} not found`);
      nock(MockUrl.ACTIONY).post(`/action`).reply(HttpStatusCode.NotFound);

      await expect(mediator.createAction(params)).rejects.toThrow(error);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(`${MockUrl.ACTIONY}/action`, params);
    });

    it('should throw parallelismMismatchError if http get returns conflict', async function () {
      const params: ActionParams = { serviceId: 'serviceId', state: 1 };
      const error = new ParallelismMismatchError(`service ${params.serviceId} has mismatched parallelism`);
      nock(MockUrl.ACTIONY).post(`/action`).reply(HttpStatusCode.Conflict);

      await expect(mediator.createAction(params)).rejects.toThrow(error);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(`${MockUrl.ACTIONY}/action`, params);
    });

    it('should throw an error if http get has errored', async function () {
      const params: ActionParams = { serviceId: 'serviceId', state: 1 };
      nock(MockUrl.ACTIONY).get(`/action`).reply(HttpStatusCode.InternalServerError);

      await expect(mediator.createAction(params)).rejects.toThrow(AxiosError);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(`${MockUrl.ACTIONY}/action`, params);
    });
  });

  describe('#updateAction', () => {
    it('should http patch params of provided actionId', async function () {
      const actionId = 'actionId';
      const params: UpdatableActionParams = { status: ActionStatus.COMPLETED };
      nock(MockUrl.ACTIONY).patch(`/action/${actionId}`).reply(HttpStatusCode.Ok);

      await expect(mediator.updateAction(params, actionId)).resolves.toBeUndefined();
      expect(patchSpy).toHaveBeenCalledTimes(1);
      expect(patchSpy).toHaveBeenCalledWith(`${MockUrl.ACTIONY}/action/${actionId}`, params);
    });

    it('should throw actionNotFoundError if http get returns not found', async function () {
      const actionId = 'actionId';
      const params: UpdatableActionParams = { status: ActionStatus.COMPLETED };
      const error = new ActionNotFoundError(`action ${actionId} not found`);
      nock(MockUrl.ACTIONY).patch(`/action/${actionId}`).reply(HttpStatusCode.NotFound);

      await expect(mediator.updateAction(params, actionId)).rejects.toThrow(error);
      expect(patchSpy).toHaveBeenCalledTimes(1);
      expect(patchSpy).toHaveBeenCalledWith(`${MockUrl.ACTIONY}/action/${actionId}`, params);
    });

    it('should throw actionAlreadyClosedError if http get returns conflict', async function () {
      const actionId = 'actionId';
      const params: UpdatableActionParams = { status: ActionStatus.COMPLETED };
      const error = new ActionAlreadyClosedError(`action ${actionId} has already been closed`);
      nock(MockUrl.ACTIONY).patch(`/action/${actionId}`).reply(HttpStatusCode.Conflict);

      await expect(mediator.updateAction(params, actionId)).rejects.toThrow(error);
      expect(patchSpy).toHaveBeenCalledTimes(1);
      expect(patchSpy).toHaveBeenCalledWith(`${MockUrl.ACTIONY}/action/${actionId}`, params);
    });

    it('should throw an error if http get has errored', async function () {
      const actionId = 'actionId';
      const params: UpdatableActionParams = { status: ActionStatus.COMPLETED };
      nock(MockUrl.ACTIONY).patch(`/action/${actionId}`).reply(HttpStatusCode.InternalServerError);

      await expect(mediator.updateAction(params, actionId)).rejects.toThrow(AxiosError);
      expect(patchSpy).toHaveBeenCalledTimes(1);
      expect(patchSpy).toHaveBeenCalledWith(`${MockUrl.ACTIONY}/action/${actionId}`, params);
    });
  });

  describe('#configuration', () => {
    it('should throw an error if misconfigured for mediation', async function () {
      const misconfiguredError = (remote: Remote) => new Error(`remote ${remote} is not configured`);

      const mediator = new Mediator({});

      await expect(mediator.fetchService('serviceId')).rejects.toThrow(misconfiguredError(Remote.REGISTRY));
      await expect(mediator.createLock({} as LockRequest)).rejects.toThrow(misconfiguredError(Remote.LOCKY));
      await expect(mediator.removeLock('lockId')).rejects.toThrow(misconfiguredError(Remote.LOCKY));
      await expect(mediator.reserveAccess('serviceId')).rejects.toThrow(misconfiguredError(Remote.LOCKY));
      await expect(mediator.filterActions({})).rejects.toThrow(misconfiguredError(Remote.ACTIONY));
      await expect(mediator.createAction({} as ActionParams)).rejects.toThrow(misconfiguredError(Remote.ACTIONY));
      await expect(mediator.updateAction({}, 'actionId')).rejects.toThrow(misconfiguredError(Remote.ACTIONY));
    });

    it('should throw an error if http request has errored with a retry strategy on every attempt', async function () {
      const networkError = new Error('Some connection error');
      const serviceId = 'serviceId';
      const mediatorWithRetry = new Mediator({
        registry: { url: MockUrl.REGISTRY },
        enableRetryStrategy: true,
        retryStrategy: {
          retries: 3,
        },
      });
      const spyWithRety = jest.spyOn(mediatorWithRetry['client'], 'get');

      nock(MockUrl.REGISTRY).persist().get(`/service/${serviceId}`).replyWithError(networkError);

      await expect(mediatorWithRetry.fetchService(serviceId)).rejects.toThrow(AxiosError);
      expect(spyWithRety).toHaveBeenCalledTimes(1);
      expect(spyWithRety).toHaveBeenCalledWith(`${MockUrl.REGISTRY}/service/${serviceId}`);
    });

    it('should complete request on the third attempt when retry strategy is enabled', async function () {
      const networkError = new Error('Some connection error');
      const serviceId = 'serviceId';
      const service = { k: 'v' };

      const mediatorWithRetry = new Mediator({
        registry: { url: MockUrl.REGISTRY },
        enableRetryStrategy: true,
        retryStrategy: {
          retries: 3,
        },
      });
      const spyWithRety = jest.spyOn(mediatorWithRetry['client'], 'get');

      nock(MockUrl.REGISTRY).get(`/service/${serviceId}`).once().replyWithError(networkError);
      nock(MockUrl.REGISTRY).get(`/service/${serviceId}`).twice().replyWithError(networkError);
      nock(MockUrl.REGISTRY).get(`/service/${serviceId}`).thrice().reply(HttpStatusCode.Ok, service);

      const response = await mediatorWithRetry.fetchService(serviceId);

      expect(response).toMatchObject(service);

      expect(spyWithRety).toHaveBeenCalledTimes(1);
      expect(spyWithRety).toHaveBeenCalledWith(`${MockUrl.REGISTRY}/service/${serviceId}`);
    });

    it('should complete request on the third attempt when retry strategy is enabled and exponential', async function () {
      const networkError = new Error('Some connection error');
      const serviceId = 'serviceId';
      const service = { k: 'v' };

      const mediatorWithRetry = new Mediator({
        registry: { url: MockUrl.REGISTRY },
        enableRetryStrategy: true,
        retryStrategy: {
          retries: 3,
          isExponential: true,
        },
      });
      const spyWithRety = jest.spyOn(mediatorWithRetry['client'], 'get');

      nock(MockUrl.REGISTRY).get(`/service/${serviceId}`).once().replyWithError(networkError);
      nock(MockUrl.REGISTRY).get(`/service/${serviceId}`).twice().replyWithError(networkError);
      nock(MockUrl.REGISTRY).get(`/service/${serviceId}`).thrice().reply(HttpStatusCode.Ok, service);

      const response = await mediatorWithRetry.fetchService(serviceId);

      expect(response).toMatchObject(service);

      expect(spyWithRety).toHaveBeenCalledTimes(1);
      expect(spyWithRety).toHaveBeenCalledWith(`${MockUrl.REGISTRY}/service/${serviceId}`);
    });
  });
});
