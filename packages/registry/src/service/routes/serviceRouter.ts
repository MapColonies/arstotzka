import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { ServiceController } from '../controllers/serviceController';

export const SERVICE_ROUTER_SYMBOL = Symbol('serviceRouterFactory');

export const serviceRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(ServiceController);

  router.get('/:serviceId', controller.getService);
  router.patch('/:serviceId/rotate', controller.rotateService);

  return router;
};
