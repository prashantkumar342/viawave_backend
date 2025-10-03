import admin from "firebase-admin";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const serviceAccount = require("./firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // projectId: serviceAccount.project_id,
});

const messaging = admin.messaging();
export { admin, messaging };
