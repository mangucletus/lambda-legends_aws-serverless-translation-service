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

