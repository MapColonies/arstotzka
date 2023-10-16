import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { runSeeder } from 'typeorm-extension';
import httpStatusCodes from 'http-status-codes';
import { DependencyContainer } from 'tsyringe';
import { faker } from '@faker-js/faker';
import { ServiceAlreadyLockedError } from '@map-colonies/arstotzka-common';
import { DataSource, QueryFailedError } from 'typeorm';
import { ServiceRepository, SERVICE_REPOSITORY_SYMBOL } from '../../../src/service/DAL/typeorm/serviceRepository';
import { DATA_SOURCE_PROVIDER } from '../../../src/common/db';
import NamespaceSeeder, { NamespaceSeederOutput } from '../../../db/seeds/namespaceSeeder';
import { getApp } from '../../../src/app';
import { IService } from '../../../src/service/models/service';
import { SERVICES } from '../../../src/common/constants';
import { BEFORE_ALL_TIMEOUT, MOCK_ROTATION_LOCK_EXPIRATION } from '../helpers';
import { Ecosystem } from '../helpers';
import { Service } from '../../../src/service/DAL/typeorm/service';
import { ServiceRequestSender } from './helpers/requestSender';
import { stringifyService } from './helpers';

let depContainer: DependencyContainer;
let seeded: Map<string, Service & { rotation: number }>;

const createLockMock = jest.fn();
const filterActionsMock = jest.fn();
const removeLockMock = jest.fn();

describe('service', function () {
  let requestSender: ServiceRequestSender;
  let serviceRepository: ServiceRepository;

  beforeAll(async function () {
    const { app, container } = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
        {
          token: SERVICES.MEDIATOR,
          provider: { useValue: { createLock: createLockMock, filterActions: filterActionsMock, removeLock: removeLockMock } },
        },
        {
          token: SERVICES.APP,
          provider: {
            useValue: {
              rotationLockExpiration: MOCK_ROTATION_LOCK_EXPIRATION,
              serviceToActionsUrlMap: new Map([['ingestion', 'http://tracker.com']]),
            },
          },
        },
      ],
      useChild: true,
    });

    depContainer = container;
    serviceRepository = depContainer.resolve<ServiceRepository>(SERVICE_REPOSITORY_SYMBOL);
    requestSender = new ServiceRequestSender(app);

    const dataSource = container.resolve<DataSource>(DATA_SOURCE_PROVIDER);
    const seedResult = await runSeeder(dataSource, NamespaceSeeder);
    const { services } = seedResult as NamespaceSeederOutput;
    seeded = services;
  }, BEFORE_ALL_TIMEOUT);

  beforeEach(function () {
    jest.resetAllMocks();
  });

  afterAll(async function () {
    await serviceRepository.delete({});
  });

  describe('Happy Path', function () {
    describe('GET /service/{serviceId}', function () {
      it('should return 200 and a detailed service with children and blockees', async function () {
        const osmdbt = seeded.get(Ecosystem.OSMDBT);
        const children = [Ecosystem.PLANET_DUMPER, Ecosystem.OSM2PG_RENDERING, Ecosystem.OSM2PG_QUERY].map((child) => seeded.get(child));
        const response = await requestSender.getService(osmdbt?.id as string);

        expect(response.status).toBe(httpStatusCodes.OK);
        const expected = stringifyService(osmdbt as IService, children as IService[], [seeded.get(Ecosystem.PLANET_DUMPER)] as IService[]);

        expect(response.body).toMatchObject({
          ...expected,
          children: expect.arrayContaining(expected.children) as string[],
          blockees: expect.arrayContaining(expected.blockees) as string[],
        });
      });

      it('should return 200 and a detailed service who has no children nor blockees', async function () {
        const rendering = seeded.get(Ecosystem.RENDERING);
        const response = await requestSender.getService(rendering?.id as string);

        expect(response.status).toBe(httpStatusCodes.OK);
        const expected = stringifyService(rendering as IService);

        expect(response.body).toMatchObject(expected);
      });

      it('should return 200 and a detailed service with children and blockees for each namespace', async function () {
        const namespace2 = (await runSeeder(depContainer.resolve<DataSource>(DATA_SOURCE_PROVIDER), NamespaceSeeder)) as NamespaceSeederOutput;

        const osmdbt1 = seeded.get(Ecosystem.OSMDBT);
        const children1 = [Ecosystem.PLANET_DUMPER, Ecosystem.OSM2PG_RENDERING, Ecosystem.OSM2PG_QUERY].map((child) => seeded.get(child));
        const expected1 = stringifyService(osmdbt1 as IService, children1 as IService[], [seeded.get(Ecosystem.PLANET_DUMPER)] as IService[]);

        const osmdbt2 = namespace2.services.get(Ecosystem.OSMDBT) as Service;
        const children2 = [Ecosystem.PLANET_DUMPER, Ecosystem.OSM2PG_RENDERING, Ecosystem.OSM2PG_QUERY].map((child) =>
          namespace2.services.get(child)
        );
        const expected2 = stringifyService(osmdbt2, children2 as IService[], [namespace2.services.get(Ecosystem.PLANET_DUMPER)] as IService[]);

        const response1 = await requestSender.getService(osmdbt1?.id as string);
        const response2 = await requestSender.getService(osmdbt2.id);

        expect(response1.status).toBe(httpStatusCodes.OK);
        expect(response1.body).toMatchObject({
          ...expected1,
          children: expect.arrayContaining(expected1.children) as string[],
          blockees: expect.arrayContaining(expected1.blockees) as string[],
        });

        expect(response2.status).toBe(httpStatusCodes.OK);
        expect(response2.body).toMatchObject({
          ...expected2,
          children: expect.arrayContaining(expected2.children) as string[],
          blockees: expect.arrayContaining(expected2.blockees) as string[],
        });
      });
    });

    describe('POST /service/{serviceId}/rotate', function () {
      it("should rotate a service who's descendants are inactive", async function () {
        createLockMock.mockResolvedValueOnce({ lockId: 'lockId' });
        filterActionsMock.mockResolvedValue([]);

        const osmdbt = seeded.get(Ecosystem.OSMDBT) as Service & { rotation: number };
        const osm2pgRendering = seeded.get(Ecosystem.OSM2PG_RENDERING) as Service & { rotation: number };
        const rendering = seeded.get(Ecosystem.RENDERING) as Service & { rotation: number };

        const children = [Ecosystem.PLANET_DUMPER, Ecosystem.OSM2PG_RENDERING, Ecosystem.OSM2PG_QUERY].map((child) => seeded.get(child));
        const descendants = [osmdbt.id, ...children.map((c) => c?.id), rendering.id];
        const roatateResponse = await requestSender.rotateService(osmdbt.id);

        expect(roatateResponse.status).toBe(httpStatusCodes.NO_CONTENT);
        expect(createLockMock).toHaveBeenCalledTimes(1);
        expect(createLockMock).toHaveBeenCalledWith(expect.objectContaining({ services: expect.arrayContaining(descendants) as string[] }));
        expect(filterActionsMock).toHaveBeenCalledTimes(descendants.length);
        expect(removeLockMock).toHaveBeenCalledTimes(1);
        expect(removeLockMock).toHaveBeenCalledWith('lockId');

        // getting the rotated service
        let detailResponse = await requestSender.getService(osmdbt.id);

        seeded.set(Ecosystem.OSMDBT, { ...osmdbt, rotation: osmdbt.rotation + 1 });
        seeded.set(Ecosystem.OSM2PG_RENDERING, { ...osm2pgRendering, rotation: osm2pgRendering.rotation + 1 });
        seeded.set(Ecosystem.RENDERING, { ...rendering, rotation: rendering.rotation + 1 });

        let expected = stringifyService(osmdbt, children as IService[], [seeded.get(Ecosystem.PLANET_DUMPER)] as IService[]);
        expect(detailResponse.body).toMatchObject({
          ...expected,
          serviceRotation: seeded.get(Ecosystem.OSMDBT)?.rotation,
          children: expect.arrayContaining(expected.children) as string[],
          blockees: expect.arrayContaining(expected.blockees) as string[],
        });

        // getting a child of the rotated service
        detailResponse = await requestSender.getService(osm2pgRendering.id);

        expected = stringifyService(osm2pgRendering);
        expect(detailResponse.body).toMatchObject({
          ...expected,
          serviceRotation: seeded.get(Ecosystem.OSM2PG_RENDERING)?.rotation,
          parentRotation: seeded.get(Ecosystem.OSMDBT)?.rotation,
          children: expect.arrayContaining(expected.children) as string[],
          blockees: expect.arrayContaining(expected.blockees) as string[],
        });

        // getting a child's child of the rotated service

        detailResponse = await requestSender.getService(rendering.id);

        expected = stringifyService(rendering);
        expect(detailResponse.body).toMatchObject({
          ...expected,
          serviceRotation: seeded.get(Ecosystem.RENDERING)?.rotation,
          parentRotation: seeded.get(Ecosystem.OSM2PG_RENDERING)?.rotation,
        });
      });

      it('should rotate a service who has no descendants', async function () {
        createLockMock.mockResolvedValueOnce({ lockId: 'lockId' });
        filterActionsMock.mockResolvedValue([]);

        const rendering = seeded.get(Ecosystem.RENDERING) as Service & { rotation: number };
        const osm2pgRendering = seeded.get(Ecosystem.OSM2PG_RENDERING) as Service & { rotation: number };
        const roatateResponse = await requestSender.rotateService(rendering.id, { description: 'some description' });

        expect(roatateResponse.status).toBe(httpStatusCodes.NO_CONTENT);
        expect(createLockMock).toHaveBeenCalledTimes(1);
        expect(filterActionsMock).toHaveBeenCalledTimes(1);
        expect(removeLockMock).toHaveBeenCalledTimes(1);
        expect(removeLockMock).toHaveBeenCalledWith('lockId');

        // getting the rotated service
        let detailResponse = await requestSender.getService(rendering.id);

        seeded.set(Ecosystem.RENDERING, { ...rendering, rotation: rendering.rotation + 1 });

        let expected = stringifyService(rendering);
        expect(detailResponse.body).toMatchObject({
          ...expected,
          serviceRotation: seeded.get(Ecosystem.RENDERING)?.rotation,
          parentRotation: seeded.get(Ecosystem.OSM2PG_RENDERING)?.rotation,
        });

        // getting the parent of the rotated service
        detailResponse = await requestSender.getService(osm2pgRendering.id);

        expected = stringifyService(osm2pgRendering as IService, [rendering] as IService[]);
        expect(detailResponse.body).toMatchObject(
          expect.objectContaining({
            ...expected,
            serviceRotation: seeded.get(Ecosystem.OSM2PG_RENDERING)?.rotation,
            parentRotation: seeded.get(Ecosystem.OSMDBT)?.rotation,
            children: expect.arrayContaining(expected.children) as string[],
            blockees: expect.arrayContaining(expected.blockees) as string[],
          })
        );
      });

      it('should rotate a service who has no parent nor children', async function () {
        createLockMock.mockResolvedValueOnce({ lockId: 'lockId' });
        filterActionsMock.mockResolvedValue([]);

        const ingestion = seeded.get(Ecosystem.INGESTION) as Service & { rotation: number };
        const roatateResponse = await requestSender.rotateService(ingestion.id);

        expect(roatateResponse.status).toBe(httpStatusCodes.NO_CONTENT);
        expect(createLockMock).toHaveBeenCalledTimes(1);
        expect(filterActionsMock).toHaveBeenCalledTimes(1);
        expect(removeLockMock).toHaveBeenCalledTimes(1);
        expect(removeLockMock).toHaveBeenCalledWith('lockId');

        // getting the rotated service
        const detailResponse = await requestSender.getService(ingestion.id);

        seeded.set(Ecosystem.INGESTION, { ...ingestion, rotation: ingestion.rotation + 1 });

        const expected = stringifyService(ingestion, [], [seeded.get(Ecosystem.PLANET_DUMPER)] as IService[]);
        expect(detailResponse.body).toMatchObject({
          ...expected,
          serviceRotation: seeded.get(Ecosystem.INGESTION)?.rotation,
          parentRotation: null,
          blockees: expect.arrayContaining(expected.blockees) as string[],
        });
      });
    });
  });

  describe('Bad Path', function () {
    describe('GET /service/{serviceId}', function () {
      it('should return 400 for an invalid id', async function () {
        const response = await requestSender.getService('fakeId');

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request.params.serviceId should match format "uuid"`);
      });

      it('should return 404 for a non existing service', async function () {
        const fakeId = faker.datatype.uuid();
        const response = await requestSender.getService(fakeId);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', `service ${fakeId} not found`);
      });
    });

    describe('POST /service/{serviceId}/rotate', function () {
      it('should return 400 for an invalid id', async function () {
        const response = await requestSender.rotateService('fakeId');

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request.params.serviceId should match format "uuid"`);
        expect(createLockMock).toHaveBeenCalledTimes(0);
        expect(filterActionsMock).toHaveBeenCalledTimes(0);
        expect(removeLockMock).toHaveBeenCalledTimes(0);
      });

      it('should return 404 for a non existing service', async function () {
        const fakeId = faker.datatype.uuid();
        const response = await requestSender.rotateService(fakeId);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', `service ${fakeId} not found`);
        expect(createLockMock).toHaveBeenCalledTimes(0);
        expect(filterActionsMock).toHaveBeenCalledTimes(0);
        expect(removeLockMock).toHaveBeenCalledTimes(0);
      });

      it('should return 409 if the rotated service is active', async function () {
        createLockMock.mockResolvedValueOnce({ lockId: 'lockId' });
        filterActionsMock.mockResolvedValueOnce([{ actionId: 'actionId' }]).mockResolvedValue([]);

        const osmdbt = seeded.get(Ecosystem.OSMDBT) as Service;
        const children = [Ecosystem.PLANET_DUMPER, Ecosystem.OSM2PG_RENDERING, Ecosystem.OSM2PG_QUERY].map((child) => seeded.get(child));
        const descendants = [osmdbt.id, ...children.map((c) => c?.id), seeded.get(Ecosystem.RENDERING)?.id];

        const response = await requestSender.rotateService(osmdbt.id);

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', `service ${osmdbt.id} has active actions`);
        expect(createLockMock).toHaveBeenCalledTimes(1);
        expect(createLockMock).toHaveBeenCalledWith(expect.objectContaining({ services: expect.arrayContaining(descendants) as string[] }));
        expect(filterActionsMock).toHaveBeenCalledTimes(descendants.length);
        expect(removeLockMock).toHaveBeenCalledTimes(1);
        expect(removeLockMock).toHaveBeenCalledWith('lockId');
      });

      it('should return 409 if one of the descendents of the rotated service is active', async function () {
        createLockMock.mockResolvedValueOnce({ lockId: 'lockId' });
        filterActionsMock
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ actionId: 'actionId' }])
          .mockResolvedValueOnce([]);

        const osmdbt = seeded.get(Ecosystem.OSMDBT) as Service;
        const children = [Ecosystem.PLANET_DUMPER, Ecosystem.OSM2PG_RENDERING, Ecosystem.OSM2PG_QUERY].map((child) => seeded.get(child));
        const descendants = [osmdbt.id, ...children.map((c) => c?.id), seeded.get(Ecosystem.RENDERING)?.id];

        const response = await requestSender.rotateService(osmdbt.id);

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(createLockMock).toHaveBeenCalledTimes(1);
        expect(createLockMock).toHaveBeenCalledWith(expect.objectContaining({ services: expect.arrayContaining(descendants) as string[] }));
        expect(filterActionsMock).toHaveBeenCalledTimes(descendants.length);
        expect(removeLockMock).toHaveBeenCalledTimes(1);
        expect(removeLockMock).toHaveBeenCalledWith('lockId');
      });

      it('should return 409 if the rotated service or one of its descendents is already locked', async function () {
        createLockMock.mockRejectedValueOnce(new ServiceAlreadyLockedError('error'));

        const osmdbt = seeded.get(Ecosystem.OSMDBT) as Service;

        const response = await requestSender.rotateService(osmdbt.id);

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', 'error');
        expect(createLockMock).toHaveBeenCalledTimes(1);
        expect(filterActionsMock).toHaveBeenCalledTimes(0);
        expect(removeLockMock).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe('Sad Path', function () {
    describe('GET /service/{serviceId}', function () {
      it('should return 500 if the db throws an error', async function () {
        const queryFailureMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));

        const { app } = await getApp({
          override: [
            { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
            { token: SERVICE_REPOSITORY_SYMBOL, provider: { useValue: { findDetailedServiceById: queryFailureMock } } },
          ],
        });
        const mockServiceRequestSender = new ServiceRequestSender(app);

        const response = await mockServiceRequestSender.getService(faker.datatype.uuid());

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('POST /service/{serviceId}/rotate', function () {
      it('should return 500 if the db throws an error', async function () {
        const queryFailureMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));

        const { app } = await getApp({
          override: [
            { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
            { token: SERVICE_REPOSITORY_SYMBOL, provider: { useValue: { findOneBy: queryFailureMock } } },
          ],
        });
        const mockServiceRequestSender = new ServiceRequestSender(app);

        const response = await mockServiceRequestSender.rotateService(faker.datatype.uuid());

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });

      it('should return 500 if the mediator throws an error', async function () {
        const mediatorFailureMock = jest.fn().mockRejectedValue(new Error('mediator failed'));

        const { app } = await getApp({
          override: [
            { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
            {
              token: SERVICE_REPOSITORY_SYMBOL,
              provider: {
                useValue: { findOneBy: jest.fn().mockResolvedValue(seeded.get(Ecosystem.OSMDBT)), findDescendants: jest.fn().mockResolvedValue([]) },
              },
            },
            { token: SERVICES.MEDIATOR, provider: { useValue: { createLock: mediatorFailureMock } } },
          ],
        });
        const mockServiceRequestSender = new ServiceRequestSender(app);

        const response = await mockServiceRequestSender.rotateService(faker.datatype.uuid());

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'mediator failed');
      });
    });
  });
});
