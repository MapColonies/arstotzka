import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import { DependencyContainer } from 'tsyringe';
import { faker } from '@faker-js/faker';
import { ServiceNotFoundError } from '@map-colonies/arstotzka-common';
import { QueryFailedError } from 'typeorm';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { LockRepository, LOCK_REPOSITORY_SYMBOL } from '../../../src/lock/DAL/typeorm/lockRepository';
import { BEFORE_ALL_TIMEOUT } from '../helpers';
import { LockRequestSender } from './helpers/requestSender';

const MOCK_RESERVE_LOCK_EXPIRATION = 2000;

let depContainer: DependencyContainer;
const filterActionsMock = jest.fn();
const fetchServiceMock = jest.fn();

describe('lock', function () {
  let requestSender: LockRequestSender;
  let lockRepository: LockRepository;

  beforeAll(async function () {
    const { app, container } = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
        {
          token: SERVICES.MEDIATOR,
          provider: { useValue: { filterActions: filterActionsMock, fetchService: fetchServiceMock } },
        },
        {
          token: SERVICES.APP,
          provider: {
            useValue: {
              reserveLockExpiration: MOCK_RESERVE_LOCK_EXPIRATION,
              serviceToActionsUrlMap: new Map([['ingestion', 'http://tracker.com']]),
            },
          },
        },
      ],
      useChild: true,
    });

    depContainer = container;
    lockRepository = depContainer.resolve<LockRepository>(LOCK_REPOSITORY_SYMBOL);
    requestSender = new LockRequestSender(app);
  }, BEFORE_ALL_TIMEOUT);

  beforeEach(function () {
    jest.resetAllMocks();
  });

  afterAll(async function () {
    await lockRepository.delete({});
  });

  describe('Happy Path', function () {
    describe('POST /lock', function () {
      it('should return 201 for newly created lock', async function () {
        const response = await requestSender.postLock({ services: [faker.datatype.uuid()] });

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toHaveProperty('lockId');
      });

      it('should return 201 for newly created lock when already expired locks of same service exist', async function () {
        const serviceId = faker.datatype.uuid();
        await lockRepository.save({ serviceIds: [serviceId], expiresAt: faker.date.past() });

        const response = await requestSender.postLock({ services: [serviceId] });

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toHaveProperty('lockId');
      });
    });

    describe('DELETE /lock/{lockId}', function () {
      it('should return 204 for successfully deleted lock if its nonexpired', async function () {
        const lock = await lockRepository.save({ serviceIds: [faker.datatype.uuid()], expiresAt: null });

        const response = await requestSender.deleteLock(lock.lockId);

        expect(response.status).toBe(httpStatusCodes.NO_CONTENT);

        const expectedNull = await lockRepository.findOneBy({ lockId: lock.lockId });

        expect(expectedNull).toBeNull();
      });

      it('should return 204 for successfully deleted lock if its expired', async function () {
        const lock = await lockRepository.save({ serviceIds: [faker.datatype.uuid()], expiresAt: faker.date.past() });

        const response = await requestSender.deleteLock(lock.lockId);

        expect(response.status).toBe(httpStatusCodes.NO_CONTENT);

        const expectedNull = await lockRepository.findOneBy({ lockId: lock.lockId });

        expect(expectedNull).toBeNull();
      });
    });

    describe('POST /lock/reserve', function () {
      it('should return 204 for a reservation of a service with no blockees', async function () {
        const serviceId = faker.datatype.uuid();
        fetchServiceMock.mockResolvedValueOnce({ serviceId, blockees: [] });

        const response = await requestSender.reserveAccess(serviceId);

        expect(response.status).toBe(httpStatusCodes.NO_CONTENT);
        expect(response.body).not.toHaveProperty('lockId');

        expect(fetchServiceMock).toHaveBeenCalledTimes(1);
        expect(fetchServiceMock).toHaveBeenCalledWith(serviceId);
        expect(filterActionsMock).toHaveBeenCalledTimes(0);
      });

      it('should return 201 and the lockId for a reservation of a service with inactive blockees', async function () {
        const namespaceName = 'n1';
        const serviceName = 's1';
        const serviceId = faker.datatype.uuid();
        const blockee1 = faker.datatype.uuid();
        const blockee2 = faker.datatype.uuid();
        const blockees = [
          { serviceId: blockee1, serviceName: '1' },
          { serviceId: blockee2, serviceName: '2' },
        ];

        fetchServiceMock.mockResolvedValueOnce({ namespaceName, serviceName, serviceId, blockees });
        filterActionsMock.mockResolvedValue([]);

        const response = await requestSender.reserveAccess(serviceId);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toHaveProperty('lockId');
        expect(fetchServiceMock).toHaveBeenCalledTimes(1);
        expect(fetchServiceMock).toHaveBeenCalledWith(serviceId);
        expect(filterActionsMock).toHaveBeenCalledTimes(blockees.length);

        const lockId = (response.body as { lockId: string }).lockId;
        const createdLock = await lockRepository.findOneBy({ lockId });

        expect(createdLock).toEqual(
          expect.objectContaining({ serviceIds: [blockee1, blockee2], reason: `${namespaceName} ${serviceName} ${serviceId} access reserve` })
        );
      });
    });
  });

  describe('Bad Path', function () {
    describe('POST /lock', function () {
      it('should return 400 for an invalid service id', async function () {
        const response = await requestSender.postLock({ services: ['badId', faker.datatype.uuid()] });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body.services[0] should match format "uuid"');
      });

      it('should return 400 for an empty services request', async function () {
        const response = await requestSender.postLock({ services: [] });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body.services should NOT have fewer than 1 items');
      });

      it('should return 400 for an invalid expiration value', async function () {
        const response = await requestSender.postLock({ services: [faker.datatype.uuid()], expiration: -1 });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body.expiration should be >= 1');
      });

      it('should return 409 if the service to be locked is already locked by a lock with no expiration date', async function () {
        const serviceId = faker.datatype.uuid();
        await lockRepository.save({ serviceIds: [serviceId], expiresAt: null });

        const response = await requestSender.postLock({ services: [serviceId] });

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', 'could not lock at least one of requested services due to nonexpired lock');
      });

      it('should return 409 if the service to be locked is already locked by a nonexpired lock', async function () {
        const serviceId = faker.datatype.uuid();
        await lockRepository.save({ serviceIds: [serviceId], expiresAt: faker.date.future() });

        const response = await requestSender.postLock({ services: [serviceId] });

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', 'could not lock at least one of requested services due to nonexpired lock');
      });

      it('should return 409 if at least one of the services to be locked is already locked', async function () {
        const serviceId = faker.datatype.uuid();
        await lockRepository.save({ serviceIds: [serviceId], expiresAt: null });

        const response = await requestSender.postLock({ services: [faker.datatype.uuid(), serviceId, faker.datatype.uuid()] });

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', 'could not lock at least one of requested services due to nonexpired lock');
      });
    });

    describe('DELETE /lock/{lockId}', function () {
      it('should return 400 if requested lockId is not valid', async function () {
        const response = await requestSender.deleteLock('badId');

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.params.lockId should match format "uuid"');
      });

      it('should return 404 if requested lockId does not exist', async function () {
        const lockId = faker.datatype.uuid();
        const response = await requestSender.deleteLock(lockId);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', `lock ${lockId} not found`);
      });
    });

    describe('POST /lock/reserve', function () {
      it('should return 400 if requested service for reservation is locked', async function () {
        const response = await requestSender.reserveAccess('badServiceId');

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.query.service should match format "uuid"');
      });

      it('should return 404 if requested service is not found through the mediator', async function () {
        fetchServiceMock.mockRejectedValue(new ServiceNotFoundError('not found'));

        const response = await requestSender.reserveAccess(faker.datatype.uuid());

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', 'not found');
      });

      it('should return 409 if requested service for reservation is locked', async function () {
        const serviceId = faker.datatype.uuid();
        await lockRepository.save({ serviceIds: [serviceId], expiresAt: null });

        const response = await requestSender.reserveAccess(serviceId);

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', 'could not reserve access for service due to nonexpired locks');
      });

      it('should return 409 if requested service has at least one active blockees', async function () {
        const serviceId = faker.datatype.uuid();
        const blockees = [
          { serviceId: faker.datatype.uuid(), serviceName: '1' },
          { serviceId: faker.datatype.uuid(), serviceName: '2' },
        ];

        fetchServiceMock.mockResolvedValueOnce({ serviceId, blockees });
        filterActionsMock.mockResolvedValueOnce([{ actionId: 'actionId' }]).mockResolvedValue([]);

        const response = await requestSender.reserveAccess(serviceId);

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', 'could not reserve access for service due to active blocking actions');
        expect(fetchServiceMock).toHaveBeenCalledTimes(1);
        expect(fetchServiceMock).toHaveBeenCalledWith(serviceId);
        expect(filterActionsMock).toHaveBeenCalledTimes(blockees.length);
      });

      it('should return 409 if requested service has at least one active blockees which is ingestion', async function () {
        const serviceId = faker.datatype.uuid();
        const blockees = [{ serviceId: faker.datatype.uuid(), serviceName: 'ingestion' }];

        fetchServiceMock.mockResolvedValueOnce({ serviceId, blockees });
        filterActionsMock.mockResolvedValueOnce([{ actionId: 'actionId' }]);

        const response = await requestSender.reserveAccess(serviceId);

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', 'could not reserve access for service due to active blocking actions');
        expect(fetchServiceMock).toHaveBeenCalledTimes(1);
        expect(fetchServiceMock).toHaveBeenCalledWith(serviceId);
        expect(filterActionsMock).toHaveBeenCalledTimes(blockees.length);
      });
    });
  });

  describe('Sad Path', function () {
    describe('POST /lock', function () {
      it('should return 500 if the db throws an error', async function () {
        const queryFailureMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));

        const { app } = await getApp({
          override: [
            { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
            { token: LOCK_REPOSITORY_SYMBOL, provider: { useValue: { findNonexpiredLocks: queryFailureMock } } },
          ],
        });
        const mockLockRequestSender = new LockRequestSender(app);

        const response = await mockLockRequestSender.postLock({ services: [faker.datatype.uuid()] });

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('DELETE /lock/{lockId}', function () {
      it('should return 500 if the db throws an error', async function () {
        const queryFailureMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));

        const { app } = await getApp({
          override: [
            { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
            { token: LOCK_REPOSITORY_SYMBOL, provider: { useValue: { findOneBy: queryFailureMock } } },
          ],
        });
        const mockLockRequestSender = new LockRequestSender(app);

        const response = await mockLockRequestSender.deleteLock(faker.datatype.uuid());

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('POST /lock/reserve', function () {
      it('should return 500 if the db throws an error', async function () {
        const queryFailureMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));

        const { app } = await getApp({
          override: [
            { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
            { token: LOCK_REPOSITORY_SYMBOL, provider: { useValue: { findNonexpiredLocks: queryFailureMock } } },
          ],
        });
        const mockLockRequestSender = new LockRequestSender(app);

        const response = await mockLockRequestSender.reserveAccess(faker.datatype.uuid());

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });

      it('should return 500 if the mediator throws an error', async function () {
        const mediatorFailureMock = jest.fn().mockRejectedValue(new Error('mediator failed'));

        const { app } = await getApp({
          override: [
            { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
            { token: LOCK_REPOSITORY_SYMBOL, provider: { useValue: { findNonexpiredLocks: jest.fn().mockResolvedValue([]) } } },
            { token: SERVICES.MEDIATOR, provider: { useValue: { fetchService: mediatorFailureMock } } },
          ],
        });
        const mockLockRequestSender = new LockRequestSender(app);

        const response = await mockLockRequestSender.reserveAccess(faker.datatype.uuid());

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'mediator failed');
      });
    });
  });
});
