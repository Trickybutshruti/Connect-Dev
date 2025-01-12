import express from 'express';
import pkg from 'agora-access-token';
const { RtcTokenBuilder, RtcRole } = pkg;
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const appId = process.env.VITE_AGORA_APP_ID;
const appCertificate = process.env.VITE_AGORA_APP_CERTIFICATE;

if (!appId || !appCertificate) {
  console.error('AGORA_APP_ID and AGORA_APP_CERTIFICATE are required');
  process.exit(1);
}

app.post('/token', (req, res) => {
  const { channelName, uid, role } = req.body;
  
  if (!channelName || !uid) {
    return res.status(400).json({ error: 'channelName and uid are required' });
  }

  let userRole;
  if (role === 'publisher') {
    userRole = RtcRole.PUBLISHER;
  } else {
    userRole = RtcRole.SUBSCRIBER;
  }

  const expirationTimeInSeconds = 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    userRole,
    privilegeExpiredTs
  );

  return res.json({ token });
});

app.listen(PORT, () => {
  console.log(`Token server is running on port ${PORT}`);
});
