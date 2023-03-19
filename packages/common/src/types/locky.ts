export interface LockRequest {
  services: string[];
  expiration?: number;
  reason?: string;
}
