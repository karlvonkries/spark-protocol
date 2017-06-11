// @flow

import type { IDeviceKeyRepository, ServerKeyRepository } from '../types';

import crypto from 'crypto';
import CryptoStream from './CryptoStream';
import NodeRSA from 'node-rsa';

const HASH_TYPE = 'sha1';

class CryptoManager {
  _deviceKeyRepository: IDeviceKeyRepository;
  _serverKeyRepository: ServerKeyRepository;
  _serverPrivateKey: Object;
  _serverKeyPassword: ?string;

  constructor(
    deviceKeyRepository: IDeviceKeyRepository,
    serverKeyRepository: ServerKeyRepository,
    serverKeyPassword: ?string,
  ) {
    this._deviceKeyRepository = deviceKeyRepository;
    this._serverKeyRepository = serverKeyRepository;
    this._serverKeyPassword = serverKeyPassword;

    (async (): Promise<void> => {
      this._serverPrivateKey = await this._getServerPrivateKey();
    })();
  }

  _createCryptoStream = (
    sessionKey: Buffer,
    encrypt: boolean,
  ): CryptoStream => {
    // The first 16 bytes (MSB first) will be the key,
    // the next 16 bytes (MSB first) will be the initialization vector (IV),
    // and the final 8 bytes (MSB first) will be the salt.

    const key = new Buffer(16); // just the key... +8); //key plus salt
    const iv = new Buffer(16); // initialization vector

    sessionKey.copy(key, 0, 0, 16); // copy the key
    sessionKey.copy(iv, 0, 16, 32); // copy the iv

    return new CryptoStream({
      iv,
      key,
      streamType: encrypt ? 'encrypt' : 'decrypt',
    });
  };

  _createServerKeys = async (): Promise<NodeRSA> => {
    const privateKey = new NodeRSA({ b: 1024 });

    await this._serverKeyRepository.createKeys(
      privateKey.exportKey('pkcs1-private-pem'),
      privateKey.exportKey('pkcs8-public-pem'),
    );

    return privateKey;
  };

  _getServerPrivateKey = async (): Promise<NodeRSA> => {
    const privateKeyString =
      await this._serverKeyRepository.getPrivateKey();

    if (!privateKeyString) {
      return await this._createServerKeys();
    }

    return new NodeRSA(
      privateKeyString,
      {
        encryptionScheme: 'pkcs1',
        signingScheme: 'pkcs1',
      },
    );
  };

  createAESCipherStream = (sessionKey: Buffer): CryptoStream =>
    this._createCryptoStream(sessionKey, true);

  createAESDecipherStream = (sessionKey: Buffer): CryptoStream =>
    this._createCryptoStream(sessionKey, false);

  createHmacDigest = (
    ciphertext: Buffer,
    sessionKey: Buffer,
  ): Buffer => {
    const hmac = crypto.createHmac(HASH_TYPE, sessionKey);
    hmac.update(ciphertext);
    return hmac.digest();
  };

  createDevicePublicKey = async (
    deviceID: string,
    publicKeyPem: string,
  ): Promise<NodeRSA> => {
    await this._deviceKeyRepository.update({ deviceID, key: publicKeyPem });
    return new NodeRSA(
      publicKeyPem,
      'pkcs8-public-pem',
      {
        encryptionScheme: 'pkcs1',
        signingScheme: 'pkcs1',
      },
    );
  };

  decrypt = (data: Buffer): Buffer =>
    this._serverPrivateKey.decrypt(
      data,
    );

  encrypt = (publicKey: NodeRSA, data: Buffer): Buffer =>
    publicKey.encrypt(
      data,
    );

  getDevicePublicKey = async (deviceID: string): Promise<?Object> => {
    const publicKeyObject = await this._deviceKeyRepository.getByID(deviceID);
    return publicKeyObject
      ? new NodeRSA(
        publicKeyObject.key,
        'pkcs8-public-pem',
        {
          encryptionScheme: 'pkcs1',
          signingScheme: 'pkcs1',
        },
      )
      : null;
  };

  keysEqual = (existingKey: NodeRSA, publicKeyPem: ? string): bool => existingKey.exportKey('pkcs8-public-pem') === publicKeyPem

  getRandomBytes = (size: number): Promise<Buffer> =>
    new Promise((
      resolve: (buffer: Buffer) => void,
      reject: (error: Error) => void,
    ) => {
      crypto.randomBytes(
        size,
        (error: ?Error, buffer: Buffer) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(buffer);
        },
      );
    });

  static getRandomUINT16 = (): number => {
    // ** - the same as Math.pow()
    const uintMax = 2 ** 16 - 1; // 65535
    return Math.floor((Math.random() * uintMax) + 1);
  };

  sign = async (hash: Buffer): Promise<Buffer> =>
    this._serverPrivateKey.encryptPrivate(hash);
}

export default CryptoManager;
