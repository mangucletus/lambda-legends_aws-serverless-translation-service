# infrastructure/backend.tf
# SIMPLIFIED: Basic Terraform backend configuration

terraform {
  backend "s3" {
    # Update this bucket name to your actual S3 bucket for Terraform state
    bucket  = "lambda-legends-terraform-state-bucket-2025"
    key     = "aws-translate-app/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
}