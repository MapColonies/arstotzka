import { ActionStatus, LockNotFoundError, LockRequest, ServiceAlreadyLockedError, ServiceNotFoundError } from '@map-colonies/arstotzka-common';
import { IMediator } from '@map-colonies/arstotzka-mediator';
import jsLogger from '@map-colonies/js-logger';
import { IAppConfig } from '../../../../src/common/interfaces';
import { LockRepository } from '../../../../src/lock/DAL/typeorm/lockRepository';
import { ActiveBlockingActionsError } from '../../../../src/lock/models/errors';
import { LockManager } from '../../../../src/lock/models/lockManager';
import { MOCK_RESERVE_LOCK_EXPIRATION } from '../../helpers';

let lockManager: LockManager;
let appConfig: IAppConfig;

describe('ServiceManager', () => {
  const findNonexpiredLocksMock = jest.fn();
  const createLockMock = jest.fn();
  const findOneByMock = jest.fn();
  const deleteLockMock = jest.fn();

  const filterActionsMock = jest.fn();
  const fetchServiceMock = jest.fn();

  beforeAll(() => {
    const lockRepository = {
      findNonexpiredLocks: findNonexpiredLocksMock,
      createLock: createLockMock,
      findOneBy: findOneByMock,
      deleteLock: deleteLockMock,
    } as unknown as LockRepository;

    const mediator = {
      filterActions: filterActionsMock,
      fetchService: fetchServiceMock,
    } as unknown as IMediator;

    appConfig = {
      reserveLockExpiration: MOCK_RESERVE_LOCK_EXPIRATION,
      serviceToActionsUrlMap: new Map([['ingestion', 'http://tracker.com']]),
    };

    lockManager = new LockManager(jsLogger({ enabled: false }), lockRepository, mediator, appConfig);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('#lock', () => {
    it('should create a lock on services and return the lockId', async () => {
      const lock = { lockId: 'lockId' };
      const request: LockRequest = { services: ['service1', 'service2'] };
      findNonexpiredLocksMock.mockResolvedValue([]);
      createLockMock.mockResolvedValue(lock.lockId);

      const response = await lockManager.lock(request);

      expect(response).toMatchObject(lock);
      expect(findNonexpiredLocksMock).toHaveBeenCalledTimes(1);
      expect(createLockMock).toHaveBeenCalledTimes(1);
      expect(findNonexpiredLocksMock).toHaveBeenCalledWith(request.services);
      expect(createLockMock).toHaveBeenCalledWith(request);
    });

    it('should reject with serviceAlreadyLockedError if one of the requested services is already locked', async () => {
      const expected = new ServiceAlreadyLockedError('could not lock at least one of requested services due to nonexpired lock');
      const request: LockRequest = { services: ['service1', 'service2'] };
      findNonexpiredLocksMock.mockResolvedValue([{ lockId: 'alreadyLocked' }]);

      await expect(lockManager.lock(request)).rejects.toThrow(expected);

      expect(findNonexpiredLocksMock).toHaveBeenCalledTimes(1);
      expect(createLockMock).toHaveBeenCalledTimes(0);
      expect(findNonexpiredLocksMock).toHaveBeenCalledWith(request.services);
    });
  });

  describe('#unlock', () => {
    it('should delete the lock', async () => {
      const lock = { lockId: 'lockId' };
      findOneByMock.mockResolvedValue(lock);

      const response = await lockManager.unlock(lock.lockId);

      expect(response).toBeUndefined();
      expect(findOneByMock).toHaveBeenCalledTimes(1);
      expect(deleteLockMock).toHaveBeenCalledTimes(1);
      expect(findOneByMock).toHaveBeenCalledWith({ lockId: lock.lockId });
      expect(deleteLockMock).toHaveBeenCalledWith(lock.lockId);
    });

    it('should reject with lockNotFoundError if the lock for deletion was not found', async () => {
      const lockId = 'lockId';
      const expected = new LockNotFoundError(`lock ${lockId} not found`);
      findOneByMock.mockResolvedValue(null);

      await expect(lockManager.unlock(lockId)).rejects.toThrow(expected);

      expect(findOneByMock).toHaveBeenCalledTimes(1);
      expect(deleteLockMock).toHaveBeenCalledTimes(0);
      expect(findOneByMock).toHaveBeenCalledWith({ lockId: lockId });
    });
  });

  describe('#reserve', () => {
    it('should reserve access for a service who has no active blockees', async () => {
      const service = { namespaceName: 'n1', serviceName: 's1', serviceId: 'service1', blockees: [{ serviceId: 'service2' }] };
      const lockId = 'lockId';
      findNonexpiredLocksMock.mockResolvedValue([]);
      fetchServiceMock.mockResolvedValue(service);
      createLockMock.mockResolvedValue(lockId);
      filterActionsMock.mockResolvedValue([]);

      const response = await lockManager.reserve(service.serviceId);

      expect(response).toMatchObject({ lockId });
      expect(findNonexpiredLocksMock).toHaveBeenCalledTimes(1);
      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(createLockMock).toHaveBeenCalledTimes(1);
      expect(filterActionsMock).toHaveBeenCalledTimes(1);
      expect(deleteLockMock).toHaveBeenCalledTimes(0);
      expect(findNonexpiredLocksMock).toHaveBeenCalledWith([service.serviceId]);
      expect(fetchServiceMock).toHaveBeenCalledWith(service.serviceId);
      expect(createLockMock).toHaveBeenCalledWith({
        services: [service.blockees[0].serviceId],
        expiration: appConfig.reserveLockExpiration,
        reason: `${service.namespaceName} ${service.serviceName} ${service.serviceId} access reserve`,
      });
      expect(filterActionsMock).toHaveBeenCalledWith({ service: service.blockees[0].serviceId, status: [ActionStatus.ACTIVE], limit: 1 });
    });

    it('should reserve access for a service who has no blockees while not creating any lock', async () => {
      const service = { serviceId: 'service1', blockees: [] };
      findNonexpiredLocksMock.mockResolvedValue([]);
      fetchServiceMock.mockResolvedValue(service);

      const response = await lockManager.reserve(service.serviceId);

      expect(response).toBeUndefined();
      expect(findNonexpiredLocksMock).toHaveBeenCalledTimes(1);
      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(createLockMock).toHaveBeenCalledTimes(0);
      expect(filterActionsMock).toHaveBeenCalledTimes(0);
      expect(deleteLockMock).toHaveBeenCalledTimes(0);
      expect(findNonexpiredLocksMock).toHaveBeenCalledWith([service.serviceId]);
      expect(fetchServiceMock).toHaveBeenCalledWith(service.serviceId);
    });

    it('should reject with serviceAlreadyLockedError if service is already locked', async () => {
      const service = { serviceId: 'service1', blockees: [] };
      const expected = new ServiceAlreadyLockedError('could not reserve access for service due to nonexpired locks');
      findNonexpiredLocksMock.mockResolvedValue([{ lockId: 'alreadyLocked' }]);

      await expect(lockManager.reserve(service.serviceId)).rejects.toThrow(expected);

      expect(findNonexpiredLocksMock).toHaveBeenCalledTimes(1);
      expect(fetchServiceMock).toHaveBeenCalledTimes(0);
      expect(createLockMock).toHaveBeenCalledTimes(0);
      expect(filterActionsMock).toHaveBeenCalledTimes(0);
      expect(deleteLockMock).toHaveBeenCalledTimes(0);
      expect(findNonexpiredLocksMock).toHaveBeenCalledWith([service.serviceId]);
    });

    it('should reject with serviceNotFound if service was not found by mediator', async () => {
      const service = { serviceId: 'nonexistingId', blockees: [] };
      const expected = new ServiceNotFoundError(`service ${service.serviceId} not found`);
      findNonexpiredLocksMock.mockResolvedValue([]);
      fetchServiceMock.mockRejectedValue(expected);

      await expect(lockManager.reserve(service.serviceId)).rejects.toThrow(expected);

      expect(findNonexpiredLocksMock).toHaveBeenCalledTimes(1);
      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(createLockMock).toHaveBeenCalledTimes(0);
      expect(filterActionsMock).toHaveBeenCalledTimes(0);
      expect(deleteLockMock).toHaveBeenCalledTimes(0);
      expect(findNonexpiredLocksMock).toHaveBeenCalledWith([service.serviceId]);
      expect(fetchServiceMock).toHaveBeenCalledWith(service.serviceId);
    });

    it('should reject with the thrown mediator error and delete created lock if thrown mid reservation', async () => {
      const service = {
        namespaceName: 'n1',
        serviceName: 's1',
        serviceId: 'service1',
        blockees: [{ serviceId: 'service2' }, { serviceId: 'service3' }],
      };
      const lockId = 'lockId';
      const expected = new Error('mediator error');
      findNonexpiredLocksMock.mockResolvedValue([]);
      fetchServiceMock.mockResolvedValue(service);
      createLockMock.mockResolvedValue(lockId);
      filterActionsMock.mockResolvedValueOnce([]).mockRejectedValueOnce(expected);

      await expect(lockManager.reserve(service.serviceId)).rejects.toThrow(expected);

      expect(findNonexpiredLocksMock).toHaveBeenCalledTimes(1);
      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(createLockMock).toHaveBeenCalledTimes(1);
      expect(filterActionsMock).toHaveBeenCalledTimes(2);
      expect(deleteLockMock).toHaveBeenCalledTimes(1);
      expect(findNonexpiredLocksMock).toHaveBeenCalledWith([service.serviceId]);
      expect(fetchServiceMock).toHaveBeenCalledWith(service.serviceId);
      expect(createLockMock).toHaveBeenCalledWith({
        services: [service.blockees[0].serviceId, service.blockees[1].serviceId],
        expiration: appConfig.reserveLockExpiration,
        reason: `${service.namespaceName} ${service.serviceName} ${service.serviceId} access reserve`,
      });
      expect(filterActionsMock).toHaveBeenNthCalledWith(1, { service: service.blockees[0].serviceId, status: [ActionStatus.ACTIVE], limit: 1 });
      expect(filterActionsMock).toHaveBeenNthCalledWith(2, { service: service.blockees[1].serviceId, status: [ActionStatus.ACTIVE], limit: 1 });
      expect(deleteLockMock).toHaveBeenCalledWith(lockId);
    });

    it('should reject with activeBlockingActionsError and delete created lock if an active blockee is found mid reservation', async () => {
      const service = {
        serviceId: 'service1',
        namespaceName: 'n1',
        serviceName: 's1',
        blockees: [
          { serviceId: '2', serviceName: 'service2' },
          { serviceId: '3', serviceName: 'ingestion' },
        ],
      };
      const lockId = 'lockId';
      const expected = new ActiveBlockingActionsError('could not reserve access for service due to active blocking actions');
      findNonexpiredLocksMock.mockResolvedValue([]);
      fetchServiceMock.mockResolvedValue(service);
      createLockMock.mockResolvedValue(lockId);
      filterActionsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ actionId: 'actionId' }]);

      await expect(lockManager.reserve(service.serviceId)).rejects.toThrow(expected);

      expect(findNonexpiredLocksMock).toHaveBeenCalledTimes(1);
      expect(fetchServiceMock).toHaveBeenCalledTimes(1);
      expect(createLockMock).toHaveBeenCalledTimes(1);
      expect(filterActionsMock).toHaveBeenCalledTimes(2);
      expect(deleteLockMock).toHaveBeenCalledTimes(1);
      expect(findNonexpiredLocksMock).toHaveBeenCalledWith([service.serviceId]);
      expect(fetchServiceMock).toHaveBeenCalledWith(service.serviceId);
      expect(createLockMock).toHaveBeenCalledWith({
        services: [service.blockees[0].serviceId, service.blockees[1].serviceId],
        expiration: appConfig.reserveLockExpiration,
        reason: `${service.namespaceName} ${service.serviceName} ${service.serviceId} access reserve`,
      });
      expect(filterActionsMock).toHaveBeenNthCalledWith(1, { service: service.blockees[0].serviceId, status: [ActionStatus.ACTIVE], limit: 1 });
      expect(filterActionsMock).toHaveBeenNthCalledWith(2, { status: 'inprogress' }, { url: appConfig.serviceToActionsUrlMap.get('ingestion') });
      expect(deleteLockMock).toHaveBeenCalledWith(lockId);
    });
  });
});
