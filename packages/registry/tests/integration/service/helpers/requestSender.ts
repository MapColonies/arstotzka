import * as supertest from 'supertest';

export class ServiceRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getService(serviceId: string): Promise<supertest.Response> {
    return supertest.agent(this.app).get(`/service/${serviceId}`);
  }

  public async rotateService(serviceId: string): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/service/${serviceId}/rotate`);
  }
}
