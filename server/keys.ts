import { FileStorage } from './storage.js';
import { randomBytes, createHash } from 'crypto';
import { Service } from './models.js';

const sha256 = (value: import('crypto').BinaryLike) => createHash('sha256').update(value).digest('hex');

export class KeyService {
  serviceKeys: FileStorage<string>;

  constructor() {
    this.serviceKeys = FileStorage.for('serviceKeys');
  }

  async createServiceKey(service: Service) {
    const serviceKeyExists = this.getServiceKey(service);
    if (serviceKeyExists) {
      throw new Error('Service already exists, key is ' + serviceKeyExists);
    }

    const serviceKeyId = sha256(service.repository);
    const serviceKey = sha256(randomBytes(256).toString('hex'));

    this.serviceKeys.set(serviceKeyId, serviceKey);

    return serviceKey;
  }

  getServiceKey(service: Service) {
    const serviceId = sha256(service.repository);
    return this.serviceKeys.get(serviceId);
  }

  deleteServiceKey(service: Service) {
    const serviceId = sha256(service.repository);
    return this.serviceKeys.delete(serviceId);
  }
}

export const KeyManager = new KeyService();
