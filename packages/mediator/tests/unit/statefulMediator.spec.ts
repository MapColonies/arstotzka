import nock from 'nock';
import { HttpStatusCode } from 'axios';
import { ActionStatus } from '@map-colonies/arstotzka-common';
import { StatefulMediator } from '../../src';
import { MockUrl } from './helpers';

const SERVICE_ID = 'serviceId';

describe('statefulMediator', () => {
  let statefulMediator: StatefulMediator;
  let postSpy: jest.SpyInstance<unknown>;
  let patchSpy: jest.SpyInstance<unknown>;
  let deleteSpy: jest.SpyInstance<unknown>;

  beforeEach(() => {
    jest.resetAllMocks();
    nock.cleanAll();

    statefulMediator = new StatefulMediator({
      registry: { url: MockUrl.REGISTRY },
      locky: { url: MockUrl.LOCKY },
      actiony: { url: MockUrl.ACTIONY },
      serviceId: SERVICE_ID,
    });
    postSpy = jest.spyOn(statefulMediator['client'], 'post');
    patchSpy = jest.spyOn(statefulMediator['client'], 'patch');
    deleteSpy = jest.spyOn(statefulMediator['client'], 'delete');
  });

  describe('flow', () => {
    it('should mediate statefully on a service who has blockees', async function () {
      const lock = { lockId: 'lockId' };
      const actionId = { actionId: 'actionId' };
      const actionCreationParams = { state: 1 };
      const actionUpdateParams = { status: ActionStatus.COMPLETED, metadata: { k: 'v' } };
      nock(MockUrl.LOCKY).post(`/lock/reserve`).query({ service: SERVICE_ID }).reply(HttpStatusCode.Created, lock);
      nock(MockUrl.ACTIONY).post(`/action`).reply(HttpStatusCode.Created, actionId);
      nock(MockUrl.ACTIONY).patch(`/action/${actionId.actionId}`).reply(HttpStatusCode.Ok);
      nock(MockUrl.LOCKY).delete(`/lock/${lock.lockId}`).reply(HttpStatusCode.NoContent);

      const reserveResponse = await statefulMediator.reserveAccess();
      const createResponse = await statefulMediator.createAction(actionCreationParams);
      const updateResponse = await statefulMediator.updateAction(actionUpdateParams);
      const unlockResponse = await statefulMediator.removeLock();

      expect(reserveResponse).toMatchObject(lock);
      expect(createResponse).toMatchObject(actionId);
      expect(updateResponse).toBeUndefined();
      expect(unlockResponse).toBeUndefined();

      expect(postSpy).toHaveBeenCalledTimes(2);
      expect(patchSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledTimes(1);

      expect(postSpy).toHaveBeenNthCalledWith(1, `${MockUrl.LOCKY}/lock/reserve`, undefined, { params: { service: SERVICE_ID } });
      expect(postSpy).toHaveBeenNthCalledWith(2, `${MockUrl.ACTIONY}/action`, { ...actionCreationParams, serviceId: SERVICE_ID });
      expect(patchSpy).toHaveBeenCalledWith(`${MockUrl.ACTIONY}/action/${actionId.actionId}`, actionUpdateParams);
      expect(deleteSpy).toHaveBeenCalledWith(`${MockUrl.LOCKY}/lock/${lock.lockId}`);
    });

    it('should mediate statefully on a service who has no blockees', async function () {
      const actionId = { actionId: 'actionId' };
      const actionCreationParams = { state: 1 };
      const actionUpdateParams = { status: ActionStatus.COMPLETED, metadata: { k: 'v' } };
      nock(MockUrl.LOCKY).post(`/lock/reserve`).query({ service: SERVICE_ID }).reply(HttpStatusCode.NoContent);
      nock(MockUrl.ACTIONY).post(`/action`).reply(HttpStatusCode.Created, actionId);
      nock(MockUrl.ACTIONY).patch(`/action/${actionId.actionId}`).reply(HttpStatusCode.Ok);

      const updateResponse1 = await statefulMediator.updateAction(actionUpdateParams);
      const reserveResponse = await statefulMediator.reserveAccess();
      const createResponse = await statefulMediator.createAction(actionCreationParams);
      const updateResponse2 = await statefulMediator.updateAction(actionUpdateParams);
      const unlockResponse = await statefulMediator.removeLock();

      expect(updateResponse1).toBeUndefined();
      expect(reserveResponse).toBe('');
      expect(createResponse).toMatchObject(actionId);
      expect(updateResponse2).toBeUndefined();
      expect(unlockResponse).toBeUndefined();

      expect(postSpy).toHaveBeenCalledTimes(2);
      expect(patchSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledTimes(0);

      expect(postSpy).toHaveBeenNthCalledWith(1, `${MockUrl.LOCKY}/lock/reserve`, undefined, { params: { service: SERVICE_ID } });
      expect(postSpy).toHaveBeenNthCalledWith(2, `${MockUrl.ACTIONY}/action`, { ...actionCreationParams, serviceId: SERVICE_ID });
      expect(patchSpy).toHaveBeenCalledWith(`${MockUrl.ACTIONY}/action/${actionId.actionId}`, actionUpdateParams);
    });
  });
});
