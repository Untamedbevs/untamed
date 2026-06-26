# untamed-video-processor

> **DEPRECATED — not used by the active flow.**
>
> The production UGC video pipeline now matches VibrationFit: files upload
> to S3 via presigned URL, then `POST /api/portal/ugc` directly submits a
> MediaConvert job via the AWS SDK. See `src/lib/video/mediaconvert.ts`.
>
> This Lambda is kept as reference for the alternate "S3 event triggers
> Lambda triggers MediaConvert" architecture. Use the VF-style flow above
> unless you have a specific reason to switch back.

AWS Lambda that watches the Untamed S3 bucket for new UGC video uploads,
submits a MediaConvert job, and notifies the Next.js app when each output
appears.

## What it does

Triggered by `s3:ObjectCreated:*` on the bucket configured in
`AWS_S3_BUCKET`, scoped to keys under `user-uploads/.../ugc/...`.

For each event, the handler decides:

| Key shape | Action |
|---|---|
| `user-uploads/{userId}/ugc/uploads/{file}.{mov\|mp4\|webm\|mkv\|avi\|m4v}` | Submit MediaConvert job (4 outputs: 1080p, 720p, original, thumb) |
| `user-uploads/{userId}/ugc/uploads/processed/{base}-1080p.mp4` (and 720p / original / thumb) | POST to `/api/ugc/processing-complete` |
| Anything else | Ignored |

MediaConvert outputs land in the same prefix under a `processed/` folder so
they can be cleanly distinguished from the original upload.

## Deploy

1. Create the IAM role first (one-time):

   ```bash
   aws iam create-role \
     --role-name untamed-video-processor-role \
     --assume-role-policy-document file://scripts/aws/lambda-trust-policy.json

   # Edit lambda-s3-policy.json and replace REPLACE_WITH_YOUR_BUCKET first.
   aws iam put-role-policy \
     --role-name untamed-video-processor-role \
     --policy-name untamed-video-processor-inline \
     --policy-document file://scripts/aws/lambda-s3-policy.json
   ```

2. Build + publish the function:

   ```bash
   cd scripts/aws/lambda/untamed-video-processor
   npm install --omit=dev
   zip -r function.zip index.js node_modules package.json

   aws lambda create-function \
     --function-name untamed-video-processor \
     --runtime nodejs20.x \
     --role "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/untamed-video-processor-role" \
     --handler index.handler \
     --timeout 60 \
     --memory-size 512 \
     --zip-file fileb://function.zip \
     --environment "Variables={MEDIACONVERT_ENDPOINT=...,MEDIACONVERT_ROLE_ARN=...,UGC_LAMBDA_WEBHOOK_SECRET=...,APP_BASE_URL=https://untamedbeverages.com,MEDIA_CDN_URL=https://media.untamedbeverages.com}"
   ```

3. Wire the S3 trigger:

   ```bash
   aws lambda add-permission \
     --function-name untamed-video-processor \
     --statement-id s3-invoke \
     --action lambda:InvokeFunction \
     --principal s3.amazonaws.com \
     --source-arn "arn:aws:s3:::YOUR_BUCKET" \
     --source-account "$(aws sts get-caller-identity --query Account --output text)"
   ```

   Then in the S3 bucket → Properties → Event notifications, add a
   notification for `All object create events` with prefix `user-uploads/`
   that targets this Lambda.

4. Updates after the first deploy:

   ```bash
   cd scripts/aws/lambda/untamed-video-processor
   npm install --omit=dev
   zip -r function.zip index.js node_modules package.json
   aws lambda update-function-code \
     --function-name untamed-video-processor \
     --zip-file fileb://function.zip
   ```

## Required env vars

| Var | Purpose |
|---|---|
| `MEDIACONVERT_ENDPOINT` | Account-specific endpoint from `aws mediaconvert describe-endpoints` |
| `MEDIACONVERT_ROLE_ARN` | Output of `scripts/aws/setup-mediaconvert.sh` |
| `UGC_LAMBDA_WEBHOOK_SECRET` | Shared secret with `/api/ugc/processing-complete` (also set on Vercel) |
| `APP_BASE_URL` | Where to POST webhook -- e.g. `https://untamedbeverages.com` |
| `MEDIA_CDN_URL` | Public CDN base URL for processed files (optional but recommended) |

## Webhook payload

The Lambda POSTs JSON to `${APP_BASE_URL}/api/ugc/processing-complete` with
header `x-untamed-webhook-secret: ${UGC_LAMBDA_WEBHOOK_SECRET}`.

```json
{
  "event": "output_ready",
  "s3Key": "user-uploads/.../uploads/processed/file-1080p.mp4",
  "baseS3Key": "user-uploads/.../uploads/processed/file",
  "outputs": {
    "1080p": "https://media.../file-1080p.mp4",
    "720p":  "https://media.../file-720p.mp4",
    "original": "https://media.../file-original.mp4",
    "thumb": "https://media.../file-thumb.0000000.jpg"
  }
}
```

The app uses `baseS3Key` to find the originating `ugc_submission_assets`
row (its `s3_key` is the original upload, e.g.
`user-uploads/.../uploads/file.mov`, with the same base filename).
