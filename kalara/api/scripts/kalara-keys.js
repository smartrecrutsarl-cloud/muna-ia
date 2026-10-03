// Génère la paire de clés qui signe les licences Kalara Premium.
//   npm run keys
// → clé privée : variable KALARA_LICENSE_PRIVATE_KEY de l'API (Railway), à garder secrète
// → clé publique : constante LICENSE_PUBLIC_KEY de kalara/app/src/premium.ts
const crypto = require('crypto');

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

console.log('KALARA_LICENSE_PRIVATE_KEY (Railway, sur une seule ligne) :\n');
console.log(pem.trim().replace(/\n/g, '\\n'));
console.log('\nLICENSE_PUBLIC_KEY (application) :\n');
console.log(spki);
