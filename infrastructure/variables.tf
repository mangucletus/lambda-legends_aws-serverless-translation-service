# infrastructure/variables.tf
# ENHANCED: Terraform variable definitions for AWS Translate Application

variable "aws_region" {
  description = "AWS region where resources will be created"
  type        = string
  default     = "us-east-1"
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.aws_region))
    error_message = "AWS region must be a valid region identifier."
  }
}

variable "project_name" {
  description = "Name of the project - used for resource naming and tagging"
  type        = string
  default     = "aws-translate-app"
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name)) && length(var.project_name) <= 20
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens, and be 20 characters or less."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "lambda_timeout" {
  description = "Timeout for Lambda function in seconds"
  type        = number
  default     = 60
  validation {
    condition     = var.lambda_timeout >= 30 && var.lambda_timeout <= 900
    error_message = "Lambda timeout must be between 30 and 900 seconds."
  }
}

variable "lambda_memory_size" {
  description = "Memory size for Lambda function in MB"
  type        = number
  default     = 256
  validation {
    condition     = var.lambda_memory_size >= 128 && var.lambda_memory_size <= 3008
    error_message = "Lambda memory size must be between 128 and 3008 MB."
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 7
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch retention period."
  }
}

variable "s3_lifecycle_requests_days" {
  description = "Number of days after which to delete objects in the requests bucket"
  type        = number
  default     = 30
  validation {
    condition     = var.s3_lifecycle_requests_days >= 1 && var.s3_lifecycle_requests_days <= 365
    error_message = "S3 lifecycle days must be between 1 and 365."
  }
}

variable "s3_lifecycle_responses_days" {
  description = "Number of days after which to delete objects in the responses bucket"
  type        = number
  default     = 90
  validation {
    condition     = var.s3_lifecycle_responses_days >= 1 && var.s3_lifecycle_responses_days <= 365
    error_message = "S3 lifecycle days must be between 1 and 365."
  }
}

variable "cognito_password_minimum_length" {
  description = "Minimum password length for Cognito User Pool"
  type        = number
  default     = 8
  validation {
    condition     = var.cognito_password_minimum_length >= 6 && var.cognito_password_minimum_length <= 99
    error_message = "Password minimum length must be between 6 and 99 characters."
  }
}

variable "cognito_token_validity_hours" {
  description = "Token validity period in hours for Cognito"
  type        = number
  default     = 24
  validation {
    condition     = var.cognito_token_validity_hours >= 1 && var.cognito_token_validity_hours <= 8760
    error_message = "Token validity must be between 1 and 8760 hours (1 year)."
  }
}

variable "api_gateway_stage_name" {
  description = "Stage name for API Gateway deployment"
  type        = string
  default     = "dev"
  validation {
    condition     = can(regex("^[a-zA-Z0-9_-]+$", var.api_gateway_stage_name))
    error_message = "API Gateway stage name must contain only alphanumeric characters, hyphens, and underscores."
  }
}

variable "cloudfront_price_class" {
  description = "CloudFront distribution price class"
  type        = string
  default     = "PriceClass_100"
  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.cloudfront_price_class)
    error_message = "CloudFront price class must be one of: PriceClass_All, PriceClass_200, PriceClass_100."
  }
}

variable "enable_cloudfront_ipv6" {
  description = "Enable IPv6 for CloudFront distribution"
  type        = bool
  default     = true
}

variable "enable_api_gateway_logs" {
  description = "Enable logging for API Gateway"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
  validation {
    condition = alltrue([
      for tag_key, tag_value in var.tags :
      can(regex("^[\\w\\s\\.\\-_:/@]*$", tag_key)) &&
      can(regex("^[\\w\\s\\.\\-_:/@]*$", tag_value)) &&
      length(tag_key) <= 128 &&
      length(tag_value) <= 256
    ])
    error_message = "Tag keys and values must follow AWS tagging rules."
  }
}

# Local variables for common tags
locals {
  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      CreatedAt   = timestamp()
      Application = "AWS Translate"
      Version     = "2.0"
    },
    var.tags
  )
}