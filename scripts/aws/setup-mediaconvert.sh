#!/bin/bash

# AWS MediaConvert Setup Script for Untamed Beverages
#
# Creates the IAM role MediaConvert needs to read S3 input + write S3 output,
# attaches MediaConvert permissions to the runtime IAM user, and prints out
# the values you need for .env.local.
#
# REQUIRES AWS ADMIN CREDENTIALS. Run with:
#   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... ./scripts/aws/setup-mediaconvert.sh
# or with `aws configure --profile untamed-admin` + AWS_PROFILE=untamed-admin

set -e

EXPECTED_ACCOUNT="486471634272"
ROLE_NAME="UntamedMediaConvertRole"
RUNTIME_USER="untamed-s3-uploader"

echo "=========================================="
echo "MediaConvert setup for Untamed Beverages"
echo "=========================================="
echo ""

# ---------------------------------------------------------------------------
# 1) Identity check -- make sure we're hitting the right account with admin
# ---------------------------------------------------------------------------
echo "[1/5] Verifying AWS credentials..."
IDENTITY=$(aws sts get-caller-identity 2>&1) || {
  echo "ERROR: AWS credentials not set or invalid"
  echo "$IDENTITY"
  exit 1
}
ACCOUNT_ID=$(echo "$IDENTITY" | grep -o '"Account": *"[^"]*"' | sed 's/.*"\([0-9]*\)".*/\1/')
ARN=$(echo "$IDENTITY" | grep -o '"Arn": *"[^"]*"' | sed 's/.*"\([^"]*\)".*/\1/')
echo "  Account : $ACCOUNT_ID"
echo "  Arn     : $ARN"

if [ "$ACCOUNT_ID" != "$EXPECTED_ACCOUNT" ]; then
  echo ""
  echo "ERROR: connected to account $ACCOUNT_ID but expected $EXPECTED_ACCOUNT"
  echo "       Switch credentials (AWS_PROFILE / AWS_ACCESS_KEY_ID) and retry."
  exit 1
fi

# Refuse to run with the runtime user -- it shouldn't have IAM admin
if echo "$ARN" | grep -q "$RUNTIME_USER$"; then
  echo ""
  echo "ERROR: this script is running as the limited runtime user '$RUNTIME_USER'."
  echo "       Export admin AWS credentials before running, e.g.:"
  echo "         AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... ./scripts/aws/setup-mediaconvert.sh"
  exit 1
fi

# ---------------------------------------------------------------------------
# 2) Create the MediaConvert service role (idempotent)
# ---------------------------------------------------------------------------
echo ""
echo "[2/5] Creating IAM role: $ROLE_NAME"
aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "mediaconvert.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' >/dev/null 2>&1 && echo "  Created." || echo "  Already exists, skipping."

echo "  Attaching AmazonS3FullAccess..."
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess >/dev/null

# ---------------------------------------------------------------------------
# 3) Grant the runtime user MediaConvert permissions
# ---------------------------------------------------------------------------
echo ""
echo "[3/5] Granting MediaConvert access to runtime user '$RUNTIME_USER'..."
aws iam attach-user-policy \
  --user-name "$RUNTIME_USER" \
  --policy-arn arn:aws:iam::aws:policy/AWSElementalMediaConvertFullAccess >/dev/null \
  && echo "  AWSElementalMediaConvertFullAccess attached." \
  || echo "  Skipped (already attached or insufficient perms)."

# iam:PassRole on the MediaConvertRole so the runtime user can pass it when
# submitting MediaConvert jobs.
PASS_ROLE_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "iam:PassRole",
    "Resource": "arn:aws:iam::'"$ACCOUNT_ID"':role/'"$ROLE_NAME"'",
    "Condition": {
      "StringEquals": {"iam:PassedToService": "mediaconvert.amazonaws.com"}
    }
  }]
}'
echo "  Attaching inline iam:PassRole policy..."
aws iam put-user-policy \
  --user-name "$RUNTIME_USER" \
  --policy-name "UntamedMediaConvertPassRole" \
  --policy-document "$PASS_ROLE_POLICY" >/dev/null

# ---------------------------------------------------------------------------
# 4) Discover the MediaConvert account endpoint
# ---------------------------------------------------------------------------
echo ""
echo "[4/5] Discovering MediaConvert endpoint..."
ENDPOINT=$(aws mediaconvert describe-endpoints --query 'Endpoints[0].Url' --output text)
echo "  $ENDPOINT"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# ---------------------------------------------------------------------------
# 5) Output
# ---------------------------------------------------------------------------
echo ""
echo "[5/5] Done. Add these to .env.local AND Vercel project env:"
echo ""
echo "------------------------------------------------------------"
echo "MEDIACONVERT_ROLE_ARN=$ROLE_ARN"
echo "MEDIACONVERT_ENDPOINT=$ENDPOINT"
echo "------------------------------------------------------------"
echo ""
echo "After updating env, verify by running:"
echo "  curl -X POST http://localhost:3000/api/admin/ugc/SUBMISSION_ID/retry-processing"
echo ""
echo "Every new submission now auto-fires MediaConvert. No Lambda needed."
