import {
  ActionAlreadyClosedError,
  ActionFilter,
  ActionNotFoundError,
  ActionParams,
  ActionStatus,
  Parallelism,
  ParallelismMismatchError,
  ServiceNotFoundError,
  UpdatableActionParams,
} from '@map-colonies/arstotzka-common';
import { IMediator } from '@map-colonies/arstotzka-mediator';
import jsLogger from '@map-colonies/js-logger';
import { ActionRepository } from '../../../../src/action/DAL/typeorm/actionRepository';
import { ActionManager } from '../../../../src/action/models/actionManager';

let actionManager: ActionManager;

describe('ActionManager', () => {
  const findActionsMock = jest.fn();
  const countActionsMock = jest.fn();
  const createActionMock = jest.fn();
  const updateLastAndCreateMock = jest.fn();
  const findOneActionByIdMock = jest.fn();
  const updateOneActionMock = jest.fn();

  const fetchServiceMock = jest.fn();

  beforeAll(() => {
    const actionRepository = {
      findActions: findActionsMock,
      countActions: countActionsMock,
      createAction: createActionMock,
      updateLastAndCreate: updateLastAndCreateMock,
      findOneActionById: findOneActionByIdMock,
      updateOneAction: updateOneActionMock,
    } as unknown as ActionRepository;

    const mediator = {
      fetchService: fetchServiceMock,
    } as unknown as IMediator;

    actionManager = new ActionManager(jsLogger({ enabled: false }), actionRepository, mediator);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('#getActions', () => {
    it('should filter for actions', async () => {
      const filter = {} as ActionFilter;
      const expected = [{ actionId: 'actionId' }];
      findActionsMock.mockResolvedValue(expected);

      const response = await actionManager.getActions(filter);

      expect(response).toMatchObject(expected);
      expect(findActionsMock).toHaveBeenCalledTimes(1);
      expect(findActionsMock).toHaveBeenCalledWith(filter);
    });
  });

  describe('#createAction', () => {
    it('should create an action for a single parallelism service who isnt active', async () => {
      const actionId = 'actionId';
      const serviceId = 'serviceId';
      const service = { serviceId, parallelism: Parallelism.SINGLE, namespaceId: 1, serviceRotation: 1, parentRotation: 1 };
      const params = { serviceId } as ActionParams;
      fetchServiceMock.mockResolvedValue(service);
      countActionsMock.mockResolvedValue(0);
      createActionMock.mockResolvedValue(actionId);

      const response = await actionManager.createAction(params);

      expect(response).toBe(actionId);
      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(countActionsMock).toHaveBeenCalledTimes(1);
      expect(createActionMock).toHaveBeenCalledTimes(1);
      expect(updateLastAndCreateMock).toHaveBeenCalledTimes(0);
      expect(fetchServiceMock).toHaveBeenCalledWith(serviceId);
      expect(countActionsMock).toHaveBeenCalledWith({ service: serviceId, status: [ActionStatus.ACTIVE] });
      expect(createActionMock).toHaveBeenCalledWith({
        ...params,
        namespaceId: service.namespaceId,
        serviceRotation: service.serviceRotation,
        parentRotation: service.parentRotation,
      });
    });

    it('should create an action for a replaceable parallelism service who isnt active', async () => {
      const actionId = 'actionId';
      const serviceId = 'serviceId';
      const service = { serviceId, parallelism: Parallelism.REPLACEABLE, namespaceId: 1, serviceRotation: 1, parentRotation: 1 };
      const params = { serviceId } as ActionParams;
      fetchServiceMock.mockResolvedValue(service);
      countActionsMock.mockResolvedValue(0);
      updateLastAndCreateMock.mockResolvedValue(actionId);

      const response = await actionManager.createAction(params);

      expect(response).toBe(actionId);
      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(countActionsMock).toHaveBeenCalledTimes(1);
      expect(createActionMock).toHaveBeenCalledTimes(0);
      expect(updateLastAndCreateMock).toHaveBeenCalledTimes(1);
      expect(fetchServiceMock).toHaveBeenCalledWith(serviceId);
      expect(countActionsMock).toHaveBeenCalledWith({ service: serviceId, status: [ActionStatus.ACTIVE] });
      expect(updateLastAndCreateMock).toHaveBeenCalledWith(
        { status: ActionStatus.CANCELED, metadata: { closingReason: 'canceled by parallelism rules' } },
        { ...params, namespaceId: service.namespaceId, serviceRotation: service.serviceRotation, parentRotation: service.parentRotation }
      );
    });

    it('should create an action for a multiple parallelism service whether it is active or not', async () => {
      const actionId = 'actionId';
      const serviceId = 'serviceId';
      const service = { serviceId, parallelism: Parallelism.MULTIPLE, namespaceId: 1, serviceRotation: 1, parentRotation: 1 };
      const params = { serviceId } as ActionParams;
      fetchServiceMock.mockResolvedValue(service);
      createActionMock.mockResolvedValue(actionId);

      const response = await actionManager.createAction(params);

      expect(response).toBe(actionId);
      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(countActionsMock).toHaveBeenCalledTimes(0);
      expect(createActionMock).toHaveBeenCalledTimes(1);
      expect(updateLastAndCreateMock).toHaveBeenCalledTimes(0);
      expect(fetchServiceMock).toHaveBeenCalledWith(serviceId);
      expect(createActionMock).toHaveBeenCalledWith({
        ...params,
        namespaceId: service.namespaceId,
        serviceRotation: service.serviceRotation,
        parentRotation: service.parentRotation,
      });
    });

    it('should create an action for a replaceable parallelism service who is active with one action', async () => {
      const actionId = 'actionId';
      const serviceId = 'serviceId';
      const service = { serviceId, parallelism: Parallelism.REPLACEABLE, namespaceId: 1, serviceRotation: 1, parentRotation: 1 };
      const params = { serviceId } as ActionParams;
      fetchServiceMock.mockResolvedValue(service);
      countActionsMock.mockResolvedValue(1);
      updateLastAndCreateMock.mockResolvedValue(actionId);

      const response = await actionManager.createAction(params);

      expect(response).toBe(actionId);
      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(countActionsMock).toHaveBeenCalledTimes(1);
      expect(createActionMock).toHaveBeenCalledTimes(0);
      expect(updateLastAndCreateMock).toHaveBeenCalledTimes(1);
      expect(fetchServiceMock).toHaveBeenCalledWith(serviceId);
      expect(countActionsMock).toHaveBeenCalledWith({ service: serviceId, status: [ActionStatus.ACTIVE] });
      expect(updateLastAndCreateMock).toHaveBeenCalledWith(
        { status: ActionStatus.CANCELED, metadata: { closingReason: 'canceled by parallelism rules' } },
        { ...params, namespaceId: service.namespaceId, serviceRotation: service.serviceRotation, parentRotation: service.parentRotation }
      );
    });

    it('should reject with parallelismMismatchError for an action of a single parallelism service who is active', async () => {
      const serviceId = 'serviceId';
      const service = { serviceId, parallelism: Parallelism.SINGLE, namespaceId: 1, serviceRotation: 1, parentRotation: 1 };
      const expected = new ParallelismMismatchError(`service ${service.serviceId} has mismatched parallelism`);
      const params = { serviceId } as ActionParams;
      fetchServiceMock.mockResolvedValue(service);
      countActionsMock.mockResolvedValue(1);

      await expect(actionManager.createAction(params)).rejects.toThrow(expected);

      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(countActionsMock).toHaveBeenCalledTimes(1);
      expect(createActionMock).toHaveBeenCalledTimes(0);
      expect(updateLastAndCreateMock).toHaveBeenCalledTimes(0);
      expect(fetchServiceMock).toHaveBeenCalledWith(serviceId);
      expect(countActionsMock).toHaveBeenCalledWith({ service: serviceId, status: [ActionStatus.ACTIVE] });
    });

    it('should reject with parallelismMismatchError for an action of a replaceable parallelism service who is active', async () => {
      const serviceId = 'serviceId';
      const service = { serviceId, parallelism: Parallelism.REPLACEABLE, namespaceId: 1, serviceRotation: 1, parentRotation: 1 };
      const expected = new ParallelismMismatchError(`service ${service.serviceId} has mismatched parallelism`);
      const params = { serviceId } as ActionParams;
      fetchServiceMock.mockResolvedValue(service);
      countActionsMock.mockResolvedValue(2);

      await expect(actionManager.createAction(params)).rejects.toThrow(expected);

      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(countActionsMock).toHaveBeenCalledTimes(1);
      expect(createActionMock).toHaveBeenCalledTimes(0);
      expect(updateLastAndCreateMock).toHaveBeenCalledTimes(0);
      expect(fetchServiceMock).toHaveBeenCalledWith(serviceId);
      expect(countActionsMock).toHaveBeenCalledWith({ service: serviceId, status: [ActionStatus.ACTIVE] });
    });

    it('should reject with serviceNotFoundError if mediator throws not found', async () => {
      const serviceId = 'serviceId';
      const expected = new ServiceNotFoundError(`service ${serviceId} not found`);
      const params = { serviceId } as ActionParams;
      fetchServiceMock.mockRejectedValue(expected);

      await expect(actionManager.createAction(params)).rejects.toThrow(expected);

      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(countActionsMock).toHaveBeenCalledTimes(0);
      expect(createActionMock).toHaveBeenCalledTimes(0);
      expect(updateLastAndCreateMock).toHaveBeenCalledTimes(0);
      expect(fetchServiceMock).toHaveBeenCalledWith(serviceId);
    });

    it('should reject with mediator error', async () => {
      const serviceId = 'serviceId';
      const expected = new Error('mediator error');
      const params = { serviceId } as ActionParams;
      fetchServiceMock.mockRejectedValue(expected);

      await expect(actionManager.createAction(params)).rejects.toThrow(expected);

      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(countActionsMock).toHaveBeenCalledTimes(0);
      expect(createActionMock).toHaveBeenCalledTimes(0);
      expect(updateLastAndCreateMock).toHaveBeenCalledTimes(0);
      expect(fetchServiceMock).toHaveBeenCalledWith(serviceId);
    });
  });

  describe('#updateAction', () => {
    it('should update given action if its active', async () => {
      const params = {} as UpdatableActionParams;
      const actionId = 'actionId';
      const action = { actionId, status: ActionStatus.ACTIVE, metadata: { k: 'v' } };
      findOneActionByIdMock.mockResolvedValue(action);

      const response = await actionManager.updateAction(actionId, params);

      expect(response).toBeUndefined();
      expect(findOneActionByIdMock).toHaveBeenCalledTimes(1);
      expect(updateOneActionMock).toHaveBeenCalledTimes(1);
      expect(findOneActionByIdMock).toHaveBeenCalledWith(actionId);
      expect(updateOneActionMock).toHaveBeenCalledWith(actionId, { ...params, metadata: { ...action.metadata, ...params.metadata } });
    });

    it('should reject with actionNotFoundError for a not found action', async () => {
      const params = {} as UpdatableActionParams;
      const actionId = 'actionId';
      const expected = new ActionNotFoundError(`action ${actionId} not found`);
      findOneActionByIdMock.mockResolvedValue(null);

      await expect(actionManager.updateAction(actionId, params)).rejects.toThrow(expected);

      expect(findOneActionByIdMock).toHaveBeenCalledTimes(1);
      expect(updateOneActionMock).toHaveBeenCalledTimes(0);
      expect(findOneActionByIdMock).toHaveBeenCalledWith(actionId);
    });

    it.each([[ActionStatus.COMPLETED], [ActionStatus.CANCELED], [ActionStatus.FAILED]])(
      `should reject with actionAlreadyClosedError for a an action with %s status`,
      async (status) => {
        const params = {} as UpdatableActionParams;
        const actionId = 'actionId';
        const action = { actionId, status, metadata: { k: 'v' } };
        const expected = new ActionAlreadyClosedError(`action ${actionId} has already been closed with status ${status}`);
        findOneActionByIdMock.mockResolvedValue(action);

        await expect(actionManager.updateAction(actionId, params)).rejects.toThrow(expected);

        expect(findOneActionByIdMock).toHaveBeenCalledTimes(1);
        expect(updateOneActionMock).toHaveBeenCalledTimes(0);
        expect(findOneActionByIdMock).toHaveBeenCalledWith(actionId);
      }
    );
  });
});
