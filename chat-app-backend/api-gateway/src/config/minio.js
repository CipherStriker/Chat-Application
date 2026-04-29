const Minio = require('minio');

const BUCKET_NAME = 'chat-files';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minio_admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minio_secret_password',
});

async function initializeMinio() {
  const exists = await minioClient.bucketExists(BUCKET_NAME);
  if (!exists) {
    await minioClient.makeBucket(BUCKET_NAME);
    console.log(`MinIO bucket "${BUCKET_NAME}" created`);
  }

  const policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
      },
    ],
  });
  await minioClient.setBucketPolicy(BUCKET_NAME, policy);
  console.log(`MinIO bucket "${BUCKET_NAME}" policy set to public-read`);
}

initializeMinio().catch((err) => {
  console.error('MinIO initialization error:', err.message);
});

module.exports = { minioClient, BUCKET_NAME };
