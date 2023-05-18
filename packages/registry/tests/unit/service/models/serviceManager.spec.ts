import { ActionStatus, ServiceNotFoundError } from '@map-colonies/arstotzka-common';
import { IMediator } from '@map-colonies/arstotzka-mediator';
import jsLogger from '@map-colonies/js-logger';
import { IAppConfig } from '../../../../src/common/interfaces';
import { ServiceRepository } from '../../../../src/service/DAL/typeorm/serviceRepository';
import { ServiceIsActiveError } from '../../../../src/service/models/errors';
import { ServiceManager } from '../../../../src/service/models/serviceManager';
import { generateBlock, generateService, MOCK_ROTATION_LOCK_EXPIRATION } from '../../helpers';

let serviceManager: ServiceManager;
let appConfig: IAppConfig;

describe('ServiceManager', () => {
  const findDetailedServiceByIdMock = jest.fn();
  const findDescendantsMock = jest.fn();
  const findBlocksMock = jest.fn();
  const findOneByMock = jest.fn();
  const createServiceRotationMock = jest.fn();

  const createLockMock = jest.fn();
  const filterActionsMock = jest.fn();
  const removeLockMock = jest.fn();

  beforeAll(() => {
    const serviceRepository = {
      findDetailedServiceById: findDetailedServiceByIdMock,
      findDescendants: findDescendantsMock,
      findBlocks: findBlocksMock,
      findOneBy: findOneByMock,
      createServiceRotation: createServiceRotationMock,
    } as unknown as ServiceRepository;

    const mediator = {
      createLock: createLockMock,
      filterActions: filterActionsMock,
      removeLock: removeLockMock,
    } as unknown as IMediator;

    appConfig = {
      rotationLockExpiration: MOCK_ROTATION_LOCK_EXPIRATION,
      serviceToActionsUrlMap: new Map([['ingestion', 'http://tracker.com']]),
    };

    serviceManager = new ServiceManager(jsLogger({ enabled: false }), serviceRepository, mediator, appConfig);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('#detail', () => {
    it('should detail a service who has no children nor blockees', async () => {
      const [service, expected] = generateService();
      findDetailedServiceByIdMock.mockResolvedValue(service);
      findDescendantsMock.mockResolvedValue({ children: [] });
      findBlocksMock.mockResolvedValue([]);

      const detailed = await serviceManager.detail(service.id);

      expect(detailed).toMatchObject(expected);
      expect(findDetailedServiceByIdMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(1);
      expect(findBlocksMock).toHaveBeenCalledTimes(1);
      expect(findDetailedServiceByIdMock).toHaveBeenCalledWith(service.id);
      expect(findDescendantsMock).toHaveBeenCalledWith(service, true, 1);
      expect(findBlocksMock).toHaveBeenCalledWith(service.id);
    });

    it('should detail a service who has children but no blockees', async () => {
      const [service, expected] = generateService();
      const [child1] = generateService({ parentServiceId: service.id });
      const [child2] = generateService({ parentServiceId: service.id });
      findDetailedServiceByIdMock.mockResolvedValue(service);
      findDescendantsMock.mockResolvedValue({ children: [child1, child2] });
      findBlocksMock.mockResolvedValue([]);

      const detailed = await serviceManager.detail(service.id);

      expect(detailed).toMatchObject({ ...expected, children: [child1.id, child2.id], blockees: [] });
      expect(findDetailedServiceByIdMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(1);
      expect(findBlocksMock).toHaveBeenCalledTimes(1);
      expect(findDetailedServiceByIdMock).toHaveBeenCalledWith(service.id);
      expect(findDescendantsMock).toHaveBeenCalledWith(service, true, 1);
      expect(findBlocksMock).toHaveBeenCalledWith(service.id);
    });

    it('should detail a service who has no children but blockees', async () => {
      const [service, expected] = generateService();
      const block1 = generateBlock({ blockerId: service.id, blockerService: service });
      const block2 = generateBlock({ blockerId: service.id, blockerService: service });
      findDetailedServiceByIdMock.mockResolvedValue(service);
      findDescendantsMock.mockResolvedValue({ children: [] });
      findBlocksMock.mockResolvedValue([block1, block2]);

      const detailed = await serviceManager.detail(service.id);

      expect(detailed).toMatchObject({
        ...expected,
        children: [],
        blockees: [
          { serviceId: block1.blockeeId, serviceName: block1.blockeeService?.name },
          { serviceId: block2.blockeeId, serviceName: block2.blockeeService?.name },
        ],
      });
      expect(findDetailedServiceByIdMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(1);
      expect(findBlocksMock).toHaveBeenCalledTimes(1);
      expect(findDetailedServiceByIdMock).toHaveBeenCalledWith(service.id);
      expect(findDescendantsMock).toHaveBeenCalledWith(service, true, 1);
      expect(findBlocksMock).toHaveBeenCalledWith(service.id);
    });

    it('should detail a service who has children and blockees', async () => {
      const [service, expected] = generateService();
      const block = generateBlock({ blockerId: service.id, blockerService: service });
      const [child] = generateService({ parentServiceId: service.id });
      findDetailedServiceByIdMock.mockResolvedValue(service);
      findDescendantsMock.mockResolvedValue({ children: [child] });
      findBlocksMock.mockResolvedValue([block]);

      const detailed = await serviceManager.detail(service.id);

      expect(detailed).toMatchObject({
        ...expected,
        children: [child.id],
        blockees: [{ serviceId: block.blockeeId, serviceName: block.blockeeService?.name }],
      });
      expect(findDetailedServiceByIdMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(1);
      expect(findBlocksMock).toHaveBeenCalledTimes(1);
      expect(findDetailedServiceByIdMock).toHaveBeenCalledWith(service.id);
      expect(findDescendantsMock).toHaveBeenCalledWith(service, true, 1);
      expect(findBlocksMock).toHaveBeenCalledWith(service.id);
    });

    it('should reject with serviceNotFoundError if the service is not found on the repository', async () => {
      const serviceId = 'serviceId';
      findDetailedServiceByIdMock.mockResolvedValue(null);

      await expect(serviceManager.detail(serviceId)).rejects.toThrow(new ServiceNotFoundError(`service ${serviceId} not found`));

      expect(findDetailedServiceByIdMock).toHaveBeenCalledWith(serviceId);
      expect(findDetailedServiceByIdMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(0);
      expect(findBlocksMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('#rotate', () => {
    it('should rotate a service who has no children', async () => {
      const [service] = generateService();
      const lock = { lockId: 'lockId' };
      findOneByMock.mockResolvedValue(service);
      findDescendantsMock.mockResolvedValue([service]);
      createLockMock.mockResolvedValue(lock);
      createServiceRotationMock.mockResolvedValue([]);
      filterActionsMock.mockResolvedValue([]);

      await expect(serviceManager.rotate(service.id)).resolves.toBeUndefined();

      expect(findOneByMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(1);
      expect(createServiceRotationMock).toHaveBeenCalledTimes(1);
      expect(createLockMock).toHaveBeenCalledTimes(1);
      expect(filterActionsMock).toHaveBeenCalledTimes(1);
      expect(removeLockMock).toHaveBeenCalledTimes(1);
      expect(findOneByMock).toHaveBeenCalledWith({ id: service.id });
      expect(findDescendantsMock).toHaveBeenCalledWith(service, false);
      expect(createLockMock).toHaveBeenCalledWith({
        services: [service.id],
        expiration: appConfig.rotationLockExpiration,
        reason: `service ${service.id} rotation`,
      });
      expect(filterActionsMock).toHaveBeenCalledWith({ service: service.id, status: [ActionStatus.ACTIVE], limit: 1 });
      expect(createServiceRotationMock).toHaveBeenCalledWith(service.id);
      expect(removeLockMock).toHaveBeenCalledWith(lock.lockId);
    });

    it('should rotate a service who has children', async () => {
      const [service] = generateService();
      const [child1] = generateService({ parentServiceId: service.id });
      const [child2] = generateService({ parentServiceId: service.id });
      const lock = { lockId: 'lockId' };
      findOneByMock.mockResolvedValue(service);
      findDescendantsMock.mockResolvedValue([service, child1, child2]);
      createLockMock.mockResolvedValue(lock);
      createServiceRotationMock.mockResolvedValue([]);
      filterActionsMock.mockResolvedValue([]);

      await expect(serviceManager.rotate(service.id)).resolves.toBeUndefined();

      expect(findOneByMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(1);
      expect(createServiceRotationMock).toHaveBeenCalledTimes(1);
      expect(createLockMock).toHaveBeenCalledTimes(1);
      expect(filterActionsMock).toHaveBeenCalledTimes(3);
      expect(removeLockMock).toHaveBeenCalledTimes(1);
      expect(findOneByMock).toHaveBeenCalledWith({ id: service.id });
      expect(findDescendantsMock).toHaveBeenCalledWith(service, false);
      expect(createLockMock).toHaveBeenCalledWith({
        services: [service.id, child1.id, child2.id],
        expiration: appConfig.rotationLockExpiration,
        reason: `service ${service.id} rotation`,
      });
      expect(filterActionsMock).toHaveBeenNthCalledWith(1, { service: service.id, status: [ActionStatus.ACTIVE], limit: 1 });
      expect(createServiceRotationMock).toHaveBeenCalledWith(service.id);
      expect(removeLockMock).toHaveBeenCalledWith(lock.lockId);
    });

    it('should reject with serviceIsActiveError if at least one child is active', async () => {
      const [service] = generateService();
      const [child1] = generateService({ parentServiceId: service.id });
      const [child2] = generateService({ parentServiceId: service.id });
      const lock = { lockId: 'lockId' };
      const expectedError = new ServiceIsActiveError(`service ${child2.id} has active actions`);
      findOneByMock.mockResolvedValue(service);
      findDescendantsMock.mockResolvedValue([service, child1, child2]);
      createLockMock.mockResolvedValue(lock);
      filterActionsMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ actionId: 'actionId' }]);

      await expect(serviceManager.rotate(service.id)).rejects.toThrow(expectedError);

      expect(findOneByMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(1);
      expect(createServiceRotationMock).toHaveBeenCalledTimes(0);
      expect(createLockMock).toHaveBeenCalledTimes(1);
      expect(filterActionsMock).toHaveBeenCalledTimes(3);
      expect(removeLockMock).toHaveBeenCalledTimes(1);
      expect(findOneByMock).toHaveBeenCalledWith({ id: service.id });
      expect(findDescendantsMock).toHaveBeenCalledWith(service, false);
      expect(createLockMock).toHaveBeenCalledWith({
        services: [service.id, child1.id, child2.id],
        expiration: appConfig.rotationLockExpiration,
        reason: `service ${service.id} rotation`,
      });
      expect(filterActionsMock).toHaveBeenNthCalledWith(1, { service: service.id, status: [ActionStatus.ACTIVE], limit: 1 });
      expect(filterActionsMock).toHaveBeenNthCalledWith(2, { service: child1.id, status: [ActionStatus.ACTIVE], limit: 1 });
      expect(filterActionsMock).toHaveBeenNthCalledWith(3, { service: child2.id, status: [ActionStatus.ACTIVE], limit: 1 });
      expect(removeLockMock).toHaveBeenCalledWith(lock.lockId);
    });

    it('should reject with serviceIsActiveError if a child which is ingestion is active', async () => {
      const [service] = generateService();
      const [child] = generateService({ name: 'ingestion', parentServiceId: service.id });
      const lock = { lockId: 'lockId' };
      const expectedError = new ServiceIsActiveError(`service ${child.id} has active actions`);
      findOneByMock.mockResolvedValue(service);
      findDescendantsMock.mockResolvedValue([service, child]);
      createLockMock.mockResolvedValue(lock);
      filterActionsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ actionId: 'actionId' }]);

      await expect(serviceManager.rotate(service.id)).rejects.toThrow(expectedError);

      expect(findOneByMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(1);
      expect(createServiceRotationMock).toHaveBeenCalledTimes(0);
      expect(createLockMock).toHaveBeenCalledTimes(1);
      expect(filterActionsMock).toHaveBeenCalledTimes(2);
      expect(removeLockMock).toHaveBeenCalledTimes(1);
      expect(findOneByMock).toHaveBeenCalledWith({ id: service.id });
      expect(findDescendantsMock).toHaveBeenCalledWith(service, false);
      expect(createLockMock).toHaveBeenCalledWith({
        services: [service.id, child.id],
        expiration: appConfig.rotationLockExpiration,
        reason: `service ${service.id} rotation`,
      });
      expect(filterActionsMock).toHaveBeenNthCalledWith(1, { service: service.id, status: [ActionStatus.ACTIVE], limit: 1 });
      expect(filterActionsMock).toHaveBeenNthCalledWith(2, { status: 'inprogress' }, { url: appConfig.serviceToActionsUrlMap.get('ingestion') });
      expect(removeLockMock).toHaveBeenCalledWith(lock.lockId);
    });

    it('should reject with serviceNotFoundError if the service is not found on the repository', async () => {
      const serviceId = 'serviceId';
      findOneByMock.mockResolvedValue(null);

      await expect(serviceManager.rotate(serviceId)).rejects.toThrow(new ServiceNotFoundError(`service ${serviceId} not found`));

      expect(findOneByMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(0);
      expect(createServiceRotationMock).toHaveBeenCalledTimes(0);
      expect(createLockMock).toHaveBeenCalledTimes(0);
      expect(filterActionsMock).toHaveBeenCalledTimes(0);
      expect(removeLockMock).toHaveBeenCalledTimes(0);
      expect(findOneByMock).toHaveBeenCalledWith({ id: serviceId });
    });

    it('should reject if mediator fails to create lock', async () => {
      const [service] = generateService();
      const error = new Error('mediator error');
      findOneByMock.mockResolvedValue(service);
      findDescendantsMock.mockResolvedValue([service]);
      createLockMock.mockRejectedValue(error);

      await expect(serviceManager.rotate(service.id)).rejects.toThrow(error);

      expect(findOneByMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(1);
      expect(createServiceRotationMock).toHaveBeenCalledTimes(0);
      expect(createLockMock).toHaveBeenCalledTimes(1);
      expect(filterActionsMock).toHaveBeenCalledTimes(0);
      expect(removeLockMock).toHaveBeenCalledTimes(0);
      expect(findOneByMock).toHaveBeenCalledWith({ id: service.id });
      expect(findDescendantsMock).toHaveBeenCalledWith(service, false);
      expect(createLockMock).toHaveBeenCalledWith({
        services: [service.id],
        expiration: appConfig.rotationLockExpiration,
        reason: `service ${service.id} rotation`,
      });
    });

    it('should reject if mediator fails to filter actions', async () => {
      const [service] = generateService();
      const [child] = generateService({ parentServiceId: service.id });
      const lock = { lockId: 'lockId' };
      const error = new Error('mediator error');
      findOneByMock.mockResolvedValue(service);
      findDescendantsMock.mockResolvedValue([service, child]);
      createLockMock.mockResolvedValue(lock);
      filterActionsMock.mockResolvedValueOnce([]).mockRejectedValueOnce(error);

      await expect(serviceManager.rotate(service.id)).rejects.toThrow(error);

      expect(findOneByMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(1);
      expect(createServiceRotationMock).toHaveBeenCalledTimes(0);
      expect(createLockMock).toHaveBeenCalledTimes(1);
      expect(filterActionsMock).toHaveBeenCalledTimes(2);
      expect(removeLockMock).toHaveBeenCalledTimes(1);
      expect(findOneByMock).toHaveBeenCalledWith({ id: service.id });
      expect(findDescendantsMock).toHaveBeenCalledWith(service, false);
      expect(filterActionsMock).toHaveBeenNthCalledWith(1, { service: service.id, status: [ActionStatus.ACTIVE], limit: 1 });
      expect(filterActionsMock).toHaveBeenNthCalledWith(2, { service: child.id, status: [ActionStatus.ACTIVE], limit: 1 });
      expect(createLockMock).toHaveBeenCalledWith({
        services: [service.id, child.id],
        expiration: appConfig.rotationLockExpiration,
        reason: `service ${service.id} rotation`,
      });
    });

    it('should reject if mediator fails to remove lock', async () => {
      const [service] = generateService();
      const lock = { lockId: 'lockId' };
      const error = new Error('mediator error');
      findOneByMock.mockResolvedValue(service);
      findDescendantsMock.mockResolvedValue([service]);
      createServiceRotationMock.mockResolvedValue([]);
      createLockMock.mockResolvedValue(lock);
      filterActionsMock.mockResolvedValue([]);
      removeLockMock.mockRejectedValue(error);

      await expect(serviceManager.rotate(service.id)).rejects.toThrow(error);

      expect(findOneByMock).toHaveBeenCalledTimes(1);
      expect(findDescendantsMock).toHaveBeenCalledTimes(1);
      expect(createServiceRotationMock).toHaveBeenCalledTimes(1);
      expect(createLockMock).toHaveBeenCalledTimes(1);
      expect(filterActionsMock).toHaveBeenCalledTimes(1);
      expect(removeLockMock).toHaveBeenCalledTimes(1);
      expect(findOneByMock).toHaveBeenCalledWith({ id: service.id });
      expect(findDescendantsMock).toHaveBeenCalledWith(service, false);
      expect(filterActionsMock).toHaveBeenCalledWith({ service: service.id, status: [ActionStatus.ACTIVE], limit: 1 });
      expect(createLockMock).toHaveBeenCalledWith({
        services: [service.id],
        expiration: appConfig.rotationLockExpiration,
        reason: `service ${service.id} rotation`,
      });
    });
  });
});
