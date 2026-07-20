/**
 * DEV-ONLY: Generates an RSA-2048 keypair and signs a 1-year ENTERPRISE license.
 * Never use generated private keys in production. Digisailor signs production
 * licenses with a private key that is never shipped with the application.
 *
 * Usage: npm run generate-dev-license -w @wms/db
 */
import { generateKeyPairSync } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const OUT_DIR = join(__dirname, 'dev-keys');

function main(): void {
  console.log('\n⚠️  DEV-ONLY LICENSE GENERATOR — DO NOT USE IN PRODUCTION\n');

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'private.pem'), privateKey, { mode: 0o600 });
  writeFileSync(join(OUT_DIR, 'public.pem'), publicKey);

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const payload = {
    licenseId: randomUUID(),
    customerName: 'Digisailor Dev Environment',
    edition: 'ENTERPRISE',
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    gracePeriodDays: 14,
    limits: {
      maxClients: -1,
      maxOpsUsers: -1,
      maxPortalUsers: -1,
      maxWarehouses: -1,
    },
    features: ['core', 'billing', 'vas', 'rma', 'edi', 'api_access', 'reports'],
  };

  const licenseKey = jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    noTimestamp: true,
  });

  const publicKeyOneLine = publicKey.replace(/\n/g, '\\n');

  console.log('═'.repeat(72));
  console.log('Add these to your .env file:\n');
  console.log(`LICENSE_PUBLIC_KEY="${publicKeyOneLine}"`);
  console.log(`LICENSE_KEY=${licenseKey}`);
  console.log('\n' + '═'.repeat(72));
  console.log(`\nKeypair written to: ${OUT_DIR}`);
  console.log(`License expires: ${expiresAt.toISOString()}`);
  console.log(`Edition: ENTERPRISE (unlimited)\n`);
}

main();
