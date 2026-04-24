import db from './src/db/index.ts';

const users = db.prepare('SELECT * FROM users').all();
const patients = db.prepare('SELECT * FROM patients').all();

console.log('Users:', JSON.stringify(users, null, 2));
console.log('Patients:', JSON.stringify(patients, null, 2));
