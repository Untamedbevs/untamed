#!/bin/bash

# AWS MediaConvert Setup Script for Untamed Beverages
# Creates the IAM role MediaConvert needs to read S3 input + write S3 output,
# and prints out the values you need for .env.local.
#
# Run with AWS admin credentials:
#   chmod +x scripts/aws/setup-mediaconvert.sh
#   ./scripts/aws/setup-mediaconvert.sh

set -e

ROLE_NAME="UntamedMediaConvertRole"

echo "Setting up AWS MediaConvert for Untamed..."
echo ""

# 1. Create the MediaConvert IAM role (idempotent)
echo "Creating IAM role: $ROLE_NAME"
aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "mediaconvert.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }' 2>/dev/null || echo "  Role already exists, skipping creation"

# 2. Attach S3 access (MediaConvert needs to read inputs and write outputs)
echo "Attaching S3 access to $ROLE_NAME"
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# 3. Discover the MediaConvert endpoint for this account
echo ""
echo "Fetching MediaConvert endpoint..."
ENDPOINT=$(aws mediaconvert describe-endpoints --query 'Endpoints[0].Url' --output text)
echo "  $ENDPOINT"

# 4. Account ID + role ARN
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

echo ""
echo "============================================================"
echo "MediaConvert is configured. Add these to your .env.local"
echo "(and to Vercel environment variables for production):"
echo "============================================================"
echo ""
echo "MEDIACONVERT_ROLE_ARN=$ROLE_ARN"
echo "MEDIACONVERT_ENDPOINT=$ENDPOINT"
echo ""
echo "Next: deploy the Lambda function in scripts/aws/lambda/untamed-video-processor/"
