const admin = require('firebase-admin');
// const serviceAccount = require('../task-management-app.json');
const serviceAccount = process.env.FIREBASE_ADMIN_CREDENTIALS;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
