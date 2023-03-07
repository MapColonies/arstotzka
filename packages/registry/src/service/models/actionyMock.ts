const TIMEOUT_MS = 250;

export interface GetActionResponse {
  serviceId: string;
  actionId: string;
  status: 'active';
}

export const getActiveActionsMock = async (serviceId: string): Promise<GetActionResponse[]> => {
  // timeout to simulate async call
  await new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS));

  if (serviceId === 'activeService') {
    return [{ serviceId: 'activeService', actionId: 'activeAction', status: 'active' }];
  }

  return [];
};
