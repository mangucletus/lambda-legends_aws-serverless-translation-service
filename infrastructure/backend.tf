# infrastructure/backend.tf
# Terraform backend configuration for remote state management

terraform {
  backend "s3" {
    # Replace 'your-terraform-state-bucket-unique-name' with your actual bucket name
    # This bucket should be created before running terraform init
    bucket = "lambda-legends-terraform-state-bucket-2025"
    
    # State file path within the bucket
    key = "aws-translate-app/terraform.tfstate"
    
    # AWS region where the backend S3 bucket is located
    region = "us-east-1"
    
    # Enable state locking and consistency checking via DynamoDB
    # DynamoDB table for state locking (optional but recommended)
    # dynamodb_table = "terraform-state-lock"
    
    # Encrypt the state file at rest
    encrypt = true
    
    # Server-side encryption configuration
    # kms_key_id = "alias/terraform-state-key"  # Optional: Use KMS key for encryption
    
    # Workspace key prefix (useful for multiple environments)
    workspace_key_prefix = "workspaces"
    
    # Skip metadata API check (useful for some CI/CD environments)
    skip_metadata_api_check = false
    
    # Skip region validation (useful for custom endpoints)
    skip_region_validation = false
    
    # Skip credential validation
    skip_credentials_validation = false
    
    # Force path style (useful for S3-compatible storage)
    force_path_style = false
  }
}

# Note: Before running 'terraform init', ensure your backend S3 bucket exists:
#
# 1. Create the bucket:
#    aws s3 mb s3://your-terraform-state-bucket-unique-name
#
# 2. Enable versioning (recommended for state file recovery):
#    aws s3api put-bucket-versioning \
#      --bucket your-terraform-state-bucket-unique-name \
#      --versioning-configuration Status=Enabled
#
# 3. Enable server-side encryption (recommended for security):
#    aws s3api put-bucket-encryption \
#      --bucket your-terraform-state-bucket-unique-name \
#      --server-side-encryption-configuration \
#      '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
#
# 4. Block public access (recommended for security):
#    aws s3api put-public-access-block \
#      --bucket your-terraform-state-bucket-unique-name \
#      --public-access-block-configuration \
#      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
#
# Optional: Create a DynamoDB table for state locking
# aws dynamodb create-table \
#   --table-name terraform-state-lock \
#   --attribute-definitions AttributeName=LockID,AttributeType=S \
#   --key-schema AttributeName=LockID,KeyType=HASH \
#   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
#   --region us-east-1