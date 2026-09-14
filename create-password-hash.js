const crypto=require('crypto');
const password=process.argv[2];
if(!password){console.error('Usage: node tools/create-password-hash.js "YOUR_PASSWORD"');process.exit(1)}
const N=16384,r=8,p=1,salt=crypto.randomBytes(16).toString('hex');
const hash=crypto.scryptSync(password,salt,32,{N,r,p}).toString('hex');
console.log(`scrypt$${N}$${r}$${p}$${salt}$${hash}`);
