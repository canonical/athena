import { config } from "@components/config/config.js";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type SecretEnvelope = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
};

const algorithm = `aes-256-gcm`;
const ivLength = 12;
const keyVersion = `v1`;

const getEncryptionKey = (): Buffer => createHash(`sha256`).update(config.authentication.session.secret).digest();

export const encryptSecret = (value: string): SecretEnvelope => {
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, `utf8`), cipher.final()]).toString(`base64`);
  const authTag = cipher.getAuthTag().toString(`base64`);

  return {
    ciphertext,
    iv: iv.toString(`base64`),
    authTag,
    keyVersion,
  };
};

export const decryptSecret = (envelope: SecretEnvelope): string => {
  const decipher = createDecipheriv(algorithm, getEncryptionKey(), Buffer.from(envelope.iv, `base64`));
  decipher.setAuthTag(Buffer.from(envelope.authTag, `base64`));

  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, `base64`)), decipher.final()]).toString(`utf8`);
};
