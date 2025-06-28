#!/bin/bash

BUCKET="aws-translate-app-frontend-31kv6epd"

echo "🧹 Emptying bucket: $BUCKET"

# Get all object versions and delete markers
aws s3api list-object-versions --bucket "$BUCKET" --output json \
| jq -c '.Versions[]?, .DeleteMarkers[]?' \
| while read -r version; do
  KEY=$(echo "$version" | jq -r .Key)
  VERSION_ID=$(echo "$version" | jq -r .VersionId)

  echo "Deleting: $KEY (version: $VERSION_ID)"
  aws s3api delete-object --bucket "$BUCKET" --key "$KEY" --version-id "$VERSION_ID"
done

echo "✅ Bucket emptied: $BUCKET"
