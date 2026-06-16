#!/bin/bash
# ----------------------------------------------------------------------------
# Untamed UGC video processor -- one-shot deploy
#
# Provisions (or updates) the Lambda that watches S3 for new UGC uploads,
# fires off MediaConvert jobs, and webhooks the app when outputs land.
#
# Pre-reqs:
#   - aws CLI v2 configured with credentials for the UNTAMED AWS account
#     (Untamed has its own account, separate from VibrationFit). Verify with:
#       aws sts get-caller-identity
#     The IAM identity must be able to create IAM roles, Lambda functions,
#     and call MediaConvert + S3 in this account.
#   - These env vars set in your shell before running:
#
#       AWS_S3_BUCKET=<the Untamed bucket name>
#       APP_BASE_URL=https://untamedbeverages.com
#       UGC_LAMBDA_WEBHOOK_SECRET=<paste from Vercel env>
#       MEDIA_CDN_URL=https://media.untamedbeverages.com     # optional
#       AWS_REGION=us-east-1                                  # or wherever
#
# Usage:
#   ./scripts/aws/deploy-video-processor.sh
#
# Idempotent: re-running updates code + env vars in place.
# ----------------------------------------------------------------------------

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LAMBDA_DIR="$REPO_ROOT/scripts/aws/lambda/untamed-video-processor"
POLICY_DIR="$REPO_ROOT/scripts/aws"

FUNCTION_NAME="untamed-video-processor"
ROLE_NAME="untamed-video-processor-role"

# ---- required env -----------------------------------------------------------
: "${AWS_S3_BUCKET:?AWS_S3_BUCKET is required}"
: "${APP_BASE_URL:?APP_BASE_URL is required (e.g. https://untamedbeverages.com)}"
: "${UGC_LAMBDA_WEBHOOK_SECRET:?UGC_LAMBDA_WEBHOOK_SECRET is required (must match Vercel env)}"

MEDIA_CDN_URL="${MEDIA_CDN_URL:-}"

echo "==> Account check"
CALLER_JSON="$(aws sts get-caller-identity)"
ACCOUNT_ID="$(echo "$CALLER_JSON" | grep -o '"Account": *"[^"]*"' | sed 's/.*"\([0-9]*\)"/\1/')"
CALLER_ARN="$(echo "$CALLER_JSON" | grep -o '"Arn": *"[^"]*"' | sed 's/.*: *"\(.*\)"/\1/')"
echo "    account: $ACCOUNT_ID"
echo "    caller:  $CALLER_ARN"
echo "    bucket:  $AWS_S3_BUCKET"
echo ""

# Sanity guard: make sure the configured bucket actually exists in this account.
# Hitting a bucket in a different account silently is the easiest way to deploy
# the Lambda into the wrong place (e.g. into VibrationFit's account).
if ! aws s3api head-bucket --bucket "$AWS_S3_BUCKET" 2>/dev/null; then
  echo "ERROR: bucket '$AWS_S3_BUCKET' is not accessible from this account."
  echo "       Make sure your AWS credentials point at the Untamed account, not VibrationFit."
  exit 1
fi

read -r -p "Deploy untamed-video-processor to account $ACCOUNT_ID? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ---- MediaConvert endpoint + role ------------------------------------------
echo "==> Resolving MediaConvert endpoint + role"
MC_ENDPOINT="$(aws mediaconvert describe-endpoints --query 'Endpoints[0].Url' --output text)"
echo "    endpoint: $MC_ENDPOINT"

if ! aws iam get-role --role-name MediaConvertRole >/dev/null 2>&1; then
  echo "    MediaConvertRole missing -- running setup-mediaconvert.sh"
  bash "$POLICY_DIR/setup-mediaconvert.sh"
fi
MC_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/MediaConvertRole"
echo "    role:     $MC_ROLE_ARN"

# ---- Lambda execution role --------------------------------------------------
echo "==> Ensuring Lambda execution role: $ROLE_NAME"
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://$POLICY_DIR/lambda-trust-policy.json" >/dev/null
  echo "    created role"
else
  echo "    role exists"
fi

# Substitute the bucket placeholder in the policy template
POLICY_TMP="$(mktemp)"
sed "s|REPLACE_WITH_YOUR_BUCKET|$AWS_S3_BUCKET|g" \
  "$POLICY_DIR/lambda-s3-policy.json" > "$POLICY_TMP"

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "untamed-video-processor-inline" \
  --policy-document "file://$POLICY_TMP" >/dev/null
rm -f "$POLICY_TMP"

# AWSLambdaBasicExecutionRole gives CloudWatch logs
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" >/dev/null

LAMBDA_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo "    arn: $LAMBDA_ROLE_ARN"

# ---- Build zip --------------------------------------------------------------
echo "==> Building deployment package"
pushd "$LAMBDA_DIR" >/dev/null
rm -f function.zip
npm install --omit=dev --silent
zip -qr function.zip index.js node_modules package.json
echo "    $(du -h function.zip | cut -f1) function.zip"
popd >/dev/null

# ---- Create or update Lambda ------------------------------------------------
ENV_VARS="Variables={MEDIACONVERT_ENDPOINT=$MC_ENDPOINT,MEDIACONVERT_ROLE_ARN=$MC_ROLE_ARN,UGC_LAMBDA_WEBHOOK_SECRET=$UGC_LAMBDA_WEBHOOK_SECRET,APP_BASE_URL=$APP_BASE_URL,MEDIA_CDN_URL=$MEDIA_CDN_URL}"

if aws lambda get-function --function-name "$FUNCTION_NAME" >/dev/null 2>&1; then
  echo "==> Updating existing Lambda code + env"
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$LAMBDA_DIR/function.zip" >/dev/null

  # update-function-code completes async; wait before updating config
  aws lambda wait function-updated --function-name "$FUNCTION_NAME"

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "$ENV_VARS" \
    --timeout 60 \
    --memory-size 512 >/dev/null
else
  echo "==> Creating Lambda (waiting up to 30s for IAM role to propagate)"
  sleep 15
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$LAMBDA_ROLE_ARN" \
    --handler index.handler \
    --timeout 60 \
    --memory-size 512 \
    --zip-file "fileb://$LAMBDA_DIR/function.zip" \
    --environment "$ENV_VARS" >/dev/null
fi

# ---- S3 invoke permission --------------------------------------------------
echo "==> Granting S3 invoke permission"
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id "s3-invoke-$AWS_S3_BUCKET" \
  --action "lambda:InvokeFunction" \
  --principal s3.amazonaws.com \
  --source-arn "arn:aws:s3:::$AWS_S3_BUCKET" \
  --source-account "$ACCOUNT_ID" >/dev/null 2>&1 || echo "    permission already exists"

echo ""
echo "==> Done."
echo ""
echo "    Function ARN: arn:aws:lambda:$(aws configure get region):${ACCOUNT_ID}:function:${FUNCTION_NAME}"
echo ""
echo "    Final manual step (one time): wire the S3 trigger."
echo "    aws s3api put-bucket-notification-configuration \\"
echo "      --bucket $AWS_S3_BUCKET \\"
echo "      --notification-configuration file://scripts/aws/s3-notification.json"
echo ""
echo "    Or via console:"
echo "      S3 -> $AWS_S3_BUCKET -> Properties -> Event notifications"
echo "        prefix:  user-uploads/"
echo "        events:  All object create events"
echo "        target:  Lambda function -> $FUNCTION_NAME"
