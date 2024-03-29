import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import { DependencyContainer } from 'tsyringe';
import { In, QueryFailedError } from 'typeorm';
import { faker } from '@faker-js/faker';
import {
  Action,
  ActionFilter,
  ActionParams,
  ActionStatus,
  Parallelism,
  ServiceNotFoundError,
  Sort,
  UpdatableActionParams,
} from '@map-colonies/arstotzka-common';
import { serializeError } from 'serialize-error';
import { ActionRepository, ACTION_REPOSITORY_SYMBOL } from '../../../src/action/DAL/typeorm/actionRepository';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { BEFORE_ALL_TIMEOUT } from '../helpers';
import { ActionRequestSender } from './helpers/requestSender';
import { generateAction, generateActionParams, generateGetServiceResponse, sortByDate, stringifyAction, stringifyActions } from './helpers';

let depContainer: DependencyContainer;

const fetchServiceMock = jest.fn();

describe('action', function () {
  let requestSender: ActionRequestSender;
  let actionRepository: ActionRepository;

  beforeAll(async function () {
    const { app, container } = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
        { token: SERVICES.MEDIATOR, provider: { useValue: { fetchService: fetchServiceMock } } },
      ],
      useChild: true,
    });

    depContainer = container;
    const repository = depContainer.resolve<ActionRepository>(ACTION_REPOSITORY_SYMBOL);
    actionRepository = repository;
    await actionRepository.clear();
    requestSender = new ActionRequestSender(app);
  }, BEFORE_ALL_TIMEOUT);

  beforeEach(async function () {
    await actionRepository.clear();
    jest.resetAllMocks();
  });

  describe('Happy Path', function () {
    describe('GET /action', function () {
      it('should return 200 for an empty filter and return an empty actions response', async function () {
        const response = await requestSender.getActions();

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject([]);
      });

      it('should return 200 for an empty filter and return the existing actions', async function () {
        const generatedAction = generateAction();
        const action = await actionRepository.save(generatedAction);

        const response = await requestSender.getActions();

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject([stringifyAction(action)]);
      });

      it('should return 200 and only the actions matching service filter', async function () {
        const action1 = generateAction();
        const action2 = generateAction();
        const actions = await actionRepository.save([action1, action2]);
        const expected = actions.filter((action) => action.serviceId === action1.serviceId);

        const response = await requestSender.getActions({ service: action1.serviceId });

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and only the actions matching rotation filter', async function () {
        const action1 = generateAction();
        const action2 = generateAction();
        const actions = await actionRepository.save([action1, action2]);
        const expected = actions.filter((action) => action.serviceRotation === action1.serviceRotation);

        const response = await requestSender.getActions({ serviceRotation: action1.serviceRotation });

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and only the actions matching rotation and parent rotation filter', async function () {
        const action1 = generateAction();
        const action2 = generateAction({ serviceId: action1.serviceId, serviceRotation: action1.serviceRotation });
        const actions = await actionRepository.save([action1, action2]);
        const expected = actions.filter(
          (action) => action.serviceRotation === action1.serviceRotation && action.parentRotation === action1.parentRotation
        );

        const response = await requestSender.getActions({ serviceRotation: action1.serviceRotation, parentRotation: action1.parentRotation });

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and only the actions matching status filter', async function () {
        const filteredStatus = ActionStatus.FAILED;
        const action1 = generateAction({ status: filteredStatus });
        const action2 = generateAction();

        const actions = await actionRepository.save([action1, action2]);
        const expected = actions.filter((action) => action.status === filteredStatus);

        const response = await requestSender.getActions({ status: [filteredStatus] });

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and only the actions matching multiple statuses filter', async function () {
        const action1 = generateAction({ status: ActionStatus.COMPLETED });
        const action2 = generateAction({ status: ActionStatus.FAILED });
        const action3 = generateAction();
        const filteredStatuses = [ActionStatus.COMPLETED, ActionStatus.FAILED];

        const actions = await actionRepository.save([action1, action2, action3]);
        const expected = actions.filter((action) => filteredStatuses.includes(action.status));

        const response = await requestSender.getActions({ status: filteredStatuses });

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and only the actions matching service and status filter', async function () {
        const filteredStatus = ActionStatus.COMPLETED;
        const filter: ActionFilter = { service: faker.datatype.uuid(), status: [filteredStatus] };

        const action1 = generateAction({ serviceId: filter.service, status: filteredStatus });
        const action2 = generateAction({ serviceId: filter.service, status: ActionStatus.FAILED });
        const action3 = generateAction({ status: filteredStatus });

        const actions = await actionRepository.save([action1, action2, action3]);
        const expected = actions.filter((action) => action.serviceId === filter.service && action.status === filteredStatus);

        const response = await requestSender.getActions(filter);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and only the actions matching service, rotation and status filter', async function () {
        const filteredStatus = ActionStatus.COMPLETED;
        const filter: ActionFilter = { service: faker.datatype.uuid(), serviceRotation: 1, status: [filteredStatus] };

        const action1 = generateAction({ serviceId: filter.service, serviceRotation: filter.serviceRotation, status: filteredStatus });
        const action2 = generateAction({ serviceId: filter.service, status: filteredStatus });
        const action3 = generateAction({ serviceId: filter.service, serviceRotation: filter.serviceRotation, status: ActionStatus.FAILED });
        const action4 = generateAction({ serviceRotation: filter.serviceRotation, status: filteredStatus });

        const actions = await actionRepository.save([action1, action2, action3, action4]);
        const expected = actions.filter(
          (action) => action.serviceId === filter.service && action.status === filteredStatus && action.serviceRotation === filter.serviceRotation
        );

        const response = await requestSender.getActions(filter);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and only limited amount of actions according to filter', async function () {
        const action1 = generateAction();
        const action2 = generateAction();
        const action3 = generateAction();
        await actionRepository.save([action1, action2, action3]);

        const response = await requestSender.getActions({ limit: 2 });

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toHaveLength(2);
      });

      it('should return 200 and ordered actions by creation time according to default', async function () {
        const action1 = generateAction();
        const action2 = generateAction();
        const action3 = generateAction();
        const res1 = await actionRepository.save(action1);
        const res2 = await actionRepository.save(action2);
        const res3 = await actionRepository.save(action3);
        const expected = sortByDate([res1, res2, res3], 'updatedAt', 'desc');

        const response = await requestSender.getActions();

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and ordered actions by creation time asc or desc accordingly', async function () {
        const action1 = generateAction();
        const action2 = generateAction();
        const action3 = generateAction();
        const res1 = await actionRepository.save(action1);
        const res2 = await actionRepository.save(action2);
        const res3 = await actionRepository.save(action3);

        const expectedAsc = sortByDate([res1, res2, res3], 'updatedAt', 'asc');
        const responseAsc = await requestSender.getActions({ sort: 'asc' });
        expect(responseAsc.status).toBe(httpStatusCodes.OK);
        expect(responseAsc.body).toMatchObject(stringifyActions(expectedAsc));

        const expectedDesc = sortByDate([res1, res2, res3], 'updatedAt', 'desc');
        const responseDesc = await requestSender.getActions({ sort: 'desc' });
        expect(responseDesc.status).toBe(httpStatusCodes.OK);
        expect(responseDesc.body).toMatchObject(stringifyActions(expectedDesc));
      });

      it('should return 200 and ordered actions by creation time desc which is the default sort', async function () {
        const action1 = generateAction();
        const action2 = generateAction();
        const action3 = generateAction();
        const res1 = await actionRepository.save(action1);
        const res2 = await actionRepository.save(action2);
        const res3 = await actionRepository.save(action3);
        const expected = sortByDate([res1, res2, res3], 'updatedAt', 'desc');

        const response = await requestSender.getActions();

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and filtered actions by multi param filter', async function () {
        const filteredStatus = ActionStatus.COMPLETED;
        const filter: ActionFilter = { service: faker.datatype.uuid(), status: [filteredStatus], sort: 'asc', limit: 2 };

        const action1 = generateAction({ serviceId: filter.service, status: filteredStatus });
        const action2 = generateAction({ serviceId: filter.service, status: ActionStatus.FAILED });
        const action3 = generateAction({ status: filteredStatus });
        const action4 = generateAction({ serviceId: filter.service, status: filteredStatus });
        const action5 = generateAction({ serviceId: filter.service, status: filteredStatus });

        const res1 = await actionRepository.save(action1);
        await actionRepository.save([action2, action3]);
        const res4 = await actionRepository.save(action4);
        const res5 = await actionRepository.save(action5);
        const expected = sortByDate([res1, res4, res5], 'updatedAt', 'asc');

        const response = await requestSender.getActions(filter);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions([expected[0], expected[1]]));
      });
    });

    describe('POST /action', function () {
      it('should return 201 and the created action id', async function () {
        const params = generateActionParams();
        const service = generateGetServiceResponse({
          serviceId: params.serviceId,
          serviceRotation: faker.datatype.number(),
          parentRotation: faker.datatype.number(),
        });
        fetchServiceMock.mockResolvedValue(service);

        const response = await requestSender.postAction(params);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toHaveProperty('actionId');

        const actionId = (response.body as { actionId: string }).actionId;
        const createdAction = await actionRepository.findOneBy({ actionId });

        expect(createdAction).toHaveProperty('serviceId', service.serviceId);
        expect(createdAction).toHaveProperty('serviceRotation', service.serviceRotation);
        expect(createdAction).toHaveProperty('parentRotation', service.parentRotation);
      });

      it('should return 201 and the created action id for action of service with no parent', async function () {
        const params = generateActionParams();
        const service = generateGetServiceResponse({ serviceId: params.serviceId, parentRotation: null });
        fetchServiceMock.mockResolvedValue(service);

        const response = await requestSender.postAction(params);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toHaveProperty('actionId');

        const actionId = (response.body as { actionId: string }).actionId;
        const createdAction = await actionRepository.findOneBy({ actionId });

        expect(createdAction).toHaveProperty('serviceId', service.serviceId);
        expect(createdAction).toHaveProperty('serviceRotation', service.serviceRotation);
      });

      it('should return 201 and the created action id for each action of service with replaceable parallelism and also close it', async function () {
        const params = generateActionParams();
        const service = generateGetServiceResponse({ serviceId: params.serviceId, parallelism: Parallelism.REPLACEABLE });
        fetchServiceMock.mockResolvedValue(service);

        const response1 = await requestSender.postAction(params);

        expect(response1.status).toBe(httpStatusCodes.CREATED);
        expect(response1.body).toHaveProperty('actionId');

        const actionId1 = (response1.body as { actionId: string }).actionId;
        const action1BeforeClosure = await actionRepository.findOneBy({ actionId: actionId1 });
        expect(action1BeforeClosure?.metadata).not.toHaveProperty('closingReason');

        const response2 = await requestSender.postAction(params);

        expect(response2.status).toBe(httpStatusCodes.CREATED);
        expect(response2.body).toHaveProperty('actionId');

        const actionId2 = (response2.body as { actionId: string }).actionId;
        const [action1, action2] = await actionRepository.find({ where: { actionId: In([actionId1, actionId2]) }, order: { createdAt: 'asc' } });

        expect(action1).toHaveProperty('serviceId', service.serviceId);
        expect(action1).toHaveProperty('serviceRotation', service.serviceRotation);
        expect(action1).toHaveProperty('parentRotation', service.parentRotation);
        expect(action1).toHaveProperty('status', ActionStatus.CANCELED);
        expect(action1.metadata).toHaveProperty('closingReason', 'canceled by parallelism rules');
        expect(action1.metadata).toMatchObject(action1BeforeClosure?.metadata as Record<string, unknown>);

        expect(action2).toHaveProperty('serviceId', service.serviceId);
        expect(action2).toHaveProperty('serviceRotation', service.serviceRotation);
        expect(action2).toHaveProperty('parentRotation', service.parentRotation);
        expect(action2).toHaveProperty('status', ActionStatus.ACTIVE);
      });

      it('should return 201 and the created action id for each action of service with multi parallelism', async function () {
        const params = generateActionParams();
        const service = generateGetServiceResponse({ serviceId: params.serviceId, parallelism: Parallelism.MULTIPLE });
        fetchServiceMock.mockResolvedValue(service);

        const response1 = await requestSender.postAction(params);

        expect(response1.status).toBe(httpStatusCodes.CREATED);
        expect(response1.body).toHaveProperty('actionId');

        const actionId1 = (response1.body as { actionId: string }).actionId;
        const createdAction1 = await actionRepository.findOneBy({ actionId: actionId1 });

        expect(createdAction1).toHaveProperty('serviceId', service.serviceId);
        expect(createdAction1).toHaveProperty('serviceRotation', service.serviceRotation);
        expect(createdAction1).toHaveProperty('parentRotation', service.parentRotation);

        const response2 = await requestSender.postAction(params);

        expect(response2.status).toBe(httpStatusCodes.CREATED);
        expect(response2.body).toHaveProperty('actionId');

        const actionId2 = (response2.body as { actionId: string }).actionId;
        const createdAction2 = await actionRepository.findOneBy({ actionId: actionId2 });

        expect(createdAction2).toHaveProperty('serviceId', service.serviceId);
        expect(createdAction2).toHaveProperty('serviceRotation', service.serviceRotation);
        expect(createdAction2).toHaveProperty('parentRotation', service.parentRotation);
      });
    });

    describe('PATCH /action/{actionId}', function () {
      it('should return 200 and update the relevant action status', async function () {
        const params = generateActionParams();
        const service = generateGetServiceResponse({ serviceId: params.serviceId });
        fetchServiceMock.mockResolvedValue(service);

        const postActionRes = await requestSender.postAction(params);
        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        // validate the action status is active
        let action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.ACTIVE);

        const response = await requestSender.patchAction(actionId, { status: ActionStatus.COMPLETED });
        expect(response.status).toBe(httpStatusCodes.OK);

        // validate the action status is completed
        action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.COMPLETED);
      });

      it('should return 200 and update the relevant action status and metadata', async function () {
        const createdMetadata = { k1: 'v1', k2: 'v2' };
        const patchedMetadata = { k1: 'patched', k2: 'v2', k3: 'added', k4: 4 };

        const params = generateActionParams({ metadata: createdMetadata });
        const service = generateGetServiceResponse({ serviceId: params.serviceId });
        fetchServiceMock.mockResolvedValue(service);

        const postActionRes = await requestSender.postAction(params);
        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        // validate the action metadata is createdMetadata
        let action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.ACTIVE);
        expect(action).toHaveProperty('metadata', createdMetadata);

        const response = await requestSender.patchAction(actionId, { status: ActionStatus.COMPLETED, metadata: patchedMetadata });
        expect(response.status).toBe(httpStatusCodes.OK);

        // validate the action metadata is patchedMetadata
        action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.COMPLETED);
        expect(action).toHaveProperty('metadata', patchedMetadata);
      });

      it('should return 200 and update the relevant action status and metadata on a failure', async function () {
        const createdMetadata = { k1: 'v1', k2: 'v2' };
        const error = new Error('some error');

        const expectedMetadata = { ...createdMetadata, ...serializeError(error) };

        const params = generateActionParams({ metadata: createdMetadata });
        const service = generateGetServiceResponse({ serviceId: params.serviceId });
        fetchServiceMock.mockResolvedValue(service);

        const postActionRes = await requestSender.postAction(params);
        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        // validate the action metadata is createdMetadata
        let action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.ACTIVE);
        expect(action).toHaveProperty('metadata', createdMetadata);

        const response = await requestSender.patchAction(actionId, { status: ActionStatus.FAILED, metadata: serializeError(error) });
        expect(response.status).toBe(httpStatusCodes.OK);

        // validate the action metadata is patchedMetadata
        action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.FAILED);
        expect(action).toHaveProperty('metadata', expectedMetadata);
      });

      it('should return 200 and update the relevant action status even if no metadata is passed', async function () {
        const createdMetadata = { k1: 'v1', k2: 'v2' };

        const params = generateActionParams({ metadata: createdMetadata });
        const service = generateGetServiceResponse({ serviceId: params.serviceId });
        fetchServiceMock.mockResolvedValue(service);

        const postActionRes = await requestSender.postAction(params);
        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        // validate the action metadata is createdMetadata
        let action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.ACTIVE);
        expect(action).toHaveProperty('metadata', createdMetadata);

        const response = await requestSender.patchAction(actionId, { status: ActionStatus.COMPLETED });
        expect(response.status).toBe(httpStatusCodes.OK);

        // validate the action metadata is patchedMetadata
        action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.COMPLETED);
        expect(action).toHaveProperty('metadata', createdMetadata);
      });
    });

    describe('FLOW', function () {
      it('should post get and patch an action through its lifecycle', async function () {
        const params = generateActionParams();
        const service = generateGetServiceResponse({ serviceId: params.serviceId });
        fetchServiceMock.mockResolvedValue(service);

        const postResponse = await requestSender.postAction(params);
        expect(postResponse.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postResponse.body as { actionId: string }).actionId;

        // validate the action status is active and closedAt is null
        let getResponse = await requestSender.getActions({ service: params.serviceId, status: [ActionStatus.ACTIVE] });
        expect(getResponse.status).toBe(httpStatusCodes.OK);
        expect(getResponse.body).toHaveLength(1);
        let action = (getResponse.body as Action[])[0];
        expect(action).toHaveProperty('status', ActionStatus.ACTIVE);
        expect(action).toHaveProperty('closedAt', null);

        // complete the action
        const patchRes = await requestSender.patchAction(actionId, { status: ActionStatus.COMPLETED });
        expect(patchRes.status).toBe(httpStatusCodes.OK);

        // validate the action status has been patched
        getResponse = await requestSender.getActions({ service: params.serviceId, status: [ActionStatus.ACTIVE] });
        expect(getResponse.status).toBe(httpStatusCodes.OK);
        expect(getResponse.body).toMatchObject([]);

        // validate the action status is completed and closedAt equals to updatedAt
        getResponse = await requestSender.getActions({ service: params.serviceId, status: [ActionStatus.COMPLETED] });
        expect(getResponse.status).toBe(httpStatusCodes.OK);
        expect(getResponse.body).toHaveLength(1);
        action = (getResponse.body as Action[])[0];
        expect(action).toHaveProperty('status', ActionStatus.COMPLETED);
        expect(action).toHaveProperty('closedAt', action.updatedAt);

        // validate another patch will fail
        const conflictingPatchRes = await requestSender.patchAction(actionId, { status: ActionStatus.COMPLETED });
        expect(conflictingPatchRes.status).toBe(httpStatusCodes.CONFLICT);
        expect(conflictingPatchRes.body).toHaveProperty('message', `action ${actionId} has already been closed with status completed`);
      });
    });
  });

  describe('Bad Path', function () {
    describe('GET /action', function () {
      it('should return 400 for a filter with non positive integer limit', async function () {
        const response = await requestSender.getActions({ limit: -1 });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.query.limit should be >= 1');
      });

      it('should return 400 for a filter with bad sort', async function () {
        const response = await requestSender.getActions({ sort: 'badSort' as Sort });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.query.sort should be equal to one of the allowed values: asc, desc');
      });

      it('should return 400 for a filter with additional properties', async function () {
        const response = await requestSender.getActions({ property: 'value' } as ActionFilter);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "Unknown query parameter 'property'");
      });

      it('should return 400 for a filter with empty service', async function () {
        const response = await requestSender.getActions({ service: '' });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "Empty value found for query parameter 'service'");
      });

      it('should return 400 for a filter with bad status', async function () {
        const response = await requestSender.getActions({ status: ['badStatus' as ActionStatus] });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          'request.query.status[0] should be equal to one of the allowed values: active, completed, failed, canceled'
        );
      });
    });

    describe('POST /action', function () {
      it('should return 400 if the request body is missing service', async function () {
        const params = generateActionParams();
        const { serviceId, ...restOfParams } = params;

        const response = await requestSender.postAction(restOfParams as ActionParams);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "request.body should have required property 'serviceId'");
      });

      it('should return 400 if the request body is missing state', async function () {
        const params = generateActionParams();
        const { state, ...restOfParams } = params;

        const response = await requestSender.postAction(restOfParams as ActionParams);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "request.body should have required property 'state'");
      });

      it('should return 400 if the request body has additional properties', async function () {
        const params = generateActionParams();

        const response = await requestSender.postAction({ ...params, additionalProperty: 'value' } as ActionParams);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body should NOT have additional properties');
      });

      it('should return 400 if the request body has an invalid metadata', async function () {
        const params = generateActionParams();

        const response = await requestSender.postAction({ ...params, metadata: 1 as unknown as Record<string, unknown> } as ActionParams);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body.metadata should be object');
      });

      it('should return 404 if the requesting service is not recognized by the registry', async function () {
        const serviceId = faker.datatype.uuid();
        const expectedMessage = `service ${serviceId} not found`;
        fetchServiceMock.mockRejectedValue(new ServiceNotFoundError(expectedMessage));

        const params = generateActionParams({ serviceId });

        const response = await requestSender.postAction(params);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', expectedMessage);
      });

      it('should return 409 if the requesting service has single parallelism and an already active action exists', async function () {
        const service = generateGetServiceResponse({ parallelism: Parallelism.SINGLE });
        fetchServiceMock.mockResolvedValue(service);
        const action = generateAction({ serviceId: service.serviceId });
        await actionRepository.save(action);

        const response = await requestSender.postAction({ serviceId: action.serviceId, state: action.state });

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', `service ${service.serviceId} has mismatched parallelism`);
      });

      it('should return 409 if the requesting service has replaceable parallelism and an already active actions exists', async function () {
        const service = generateGetServiceResponse({ parallelism: Parallelism.REPLACEABLE });
        fetchServiceMock.mockResolvedValue(service);
        const action1 = generateAction({ serviceId: service.serviceId });
        const action2 = generateAction({ serviceId: service.serviceId });
        await actionRepository.save([action1, action2]);

        const response = await requestSender.postAction({ serviceId: service.serviceId, state: action2.state });

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', `service ${service.serviceId} has mismatched parallelism`);
      });
    });

    describe('PATCH /action/{actionId}', function () {
      it('should return 400 if the request body has an invalid status', async function () {
        const params = generateActionParams();
        const service = generateGetServiceResponse({ serviceId: params.serviceId });
        fetchServiceMock.mockResolvedValue(service);

        const postActionRes = await requestSender.postAction(params);

        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        const response = await requestSender.patchAction(actionId, { status: 'badStatus' as ActionStatus });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          'request.body.status should be equal to one of the allowed values: active, completed, failed, canceled'
        );
      });

      it('should return 400 if the request body has an invalid metadata', async function () {
        const params = generateActionParams();
        const service = generateGetServiceResponse({ serviceId: params.serviceId });
        fetchServiceMock.mockResolvedValue(service);

        const postActionRes = await requestSender.postAction(params);

        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        const response = await requestSender.patchAction(actionId, { metadata: 1 as unknown as Record<string, unknown> });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body.metadata should be object');
      });

      it('should return 400 if the request body has additional properties', async function () {
        const params = generateActionParams();
        const service = generateGetServiceResponse({ serviceId: params.serviceId });
        fetchServiceMock.mockResolvedValue(service);

        const postActionRes = await requestSender.postAction(params);

        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        const response = await requestSender.patchAction(actionId, {
          status: ActionStatus.ACTIVE,
          metadata: { k: 'v' },
          additionalProperty: '1',
        } as UpdatableActionParams);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body should NOT have additional properties');
      });

      it('should return 400 if the request body is empty', async function () {
        const params = generateActionParams();
        const service = generateGetServiceResponse({ serviceId: params.serviceId });
        fetchServiceMock.mockResolvedValue(service);

        const postActionRes = await requestSender.postAction(params);

        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        const response = await requestSender.patchAction(actionId, {});

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body should NOT have fewer than 1 properties');
      });

      it('should return 400 if the actionId param invalid', async function () {
        const response = await requestSender.patchAction('badActionId', { status: ActionStatus.CANCELED });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.params.actionId should match format "uuid"');
      });

      it('should return 404 if the patched action does not exist', async function () {
        const uuid = faker.datatype.uuid();
        const response = await requestSender.patchAction(uuid, { status: ActionStatus.CANCELED });

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', `action ${uuid} not found`);
      });

      it('should return 409 if the patched action has already been closed', async function () {
        const closingStatus = ActionStatus.COMPLETED;
        const params = generateActionParams();
        const service = generateGetServiceResponse({ serviceId: params.serviceId });
        fetchServiceMock.mockResolvedValue(service);

        let response = await requestSender.postAction(params);
        expect(response.status).toBe(httpStatusCodes.CREATED);
        const actionId = (response.body as { actionId: string }).actionId;

        // validate the action status is active
        const action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.ACTIVE);

        // first patch should succeed
        response = await requestSender.patchAction(actionId, { status: closingStatus });
        expect(response.status).toBe(httpStatusCodes.OK);

        // second patch should conflict
        response = await requestSender.patchAction(actionId, { status: ActionStatus.COMPLETED });
        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', `action ${actionId} has already been closed with status ${closingStatus}`);
      });
    });
  });

  describe('Sad Path', function () {
    describe('GET /action', function () {
      it('should return 500 if the db throws an error', async function () {
        const queryFailureMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));

        const { app } = await getApp({
          override: [
            { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
            { token: ACTION_REPOSITORY_SYMBOL, provider: { useValue: { findActions: queryFailureMock } } },
          ],
        });
        const mockActionRequestSender = new ActionRequestSender(app);

        const response = await mockActionRequestSender.getActions();

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });

    describe('POST /action', function () {
      it('should return 500 if the db throws an error', async function () {
        const queryFailureMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));

        const { app } = await getApp({
          override: [
            { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
            { token: SERVICES.MEDIATOR, provider: { useValue: { fetchService: fetchServiceMock } } },
            {
              token: ACTION_REPOSITORY_SYMBOL,
              provider: { useValue: { createAction: queryFailureMock, findActions: jest.fn().mockResolvedValue([]) } },
            },
          ],
        });
        const mockActionRequestSender = new ActionRequestSender(app);

        const params = generateActionParams();
        const service = generateGetServiceResponse({ serviceId: params.serviceId, parallelism: Parallelism.MULTIPLE });
        fetchServiceMock.mockResolvedValue(service);

        const response = await mockActionRequestSender.postAction(params);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });

      it('should return 500 if the mediator throws an error', async function () {
        const mediatorFailureMock = jest.fn().mockRejectedValue(new Error('mediator failed'));

        const { app } = await getApp({
          override: [
            { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
            { token: SERVICES.MEDIATOR, provider: { useValue: { fetchService: mediatorFailureMock } } },
          ],
        });
        const mockActionRequestSender = new ActionRequestSender(app);

        const params = generateActionParams();

        const response = await mockActionRequestSender.postAction(params);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'mediator failed');
      });
    });

    describe('PATCH /action/{actionId}', function () {
      it('should return 500 if the db throws an error', async function () {
        const queryFailureMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));

        const { app } = await getApp({
          override: [
            { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
            {
              token: ACTION_REPOSITORY_SYMBOL,
              provider: {
                useValue: { findOneActionById: jest.fn().mockResolvedValue({ status: ActionStatus.ACTIVE }), updateOneAction: queryFailureMock },
              },
            },
          ],
        });
        const mockActionRequestSender = new ActionRequestSender(app);

        const response = await mockActionRequestSender.patchAction(faker.datatype.uuid(), { status: ActionStatus.ACTIVE });

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'failed');
      });
    });
  });
});
