# infrastructure/main.tf
# Main Terraform configuration with FIXED CloudFront MIME type handling

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false

  lifecycle {
    ignore_changes = [result]
  }
}

resource "aws_s3_bucket" "request_bucket" {
  bucket = "${var.project_name}-requests-${random_string.suffix.result}"

  tags = {
    Name        = "Translation Requests Bucket"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket" "response_bucket" {
  bucket = "${var.project_name}-responses-${random_string.suffix.result}"

  tags = {
    Name        = "Translation Responses Bucket"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket" "frontend_bucket" {
  bucket = "${var.project_name}-frontend-${random_string.suffix.result}"

  tags = {
    Name        = "Frontend Hosting Bucket"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket_versioning" "request_bucket_versioning" {
  bucket = aws_s3_bucket.request_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "response_bucket_versioning" {
  bucket = aws_s3_bucket.response_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "request_bucket_pab" {
  bucket = aws_s3_bucket.request_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "response_bucket_pab" {
  bucket = aws_s3_bucket.response_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "request_bucket_lifecycle" {
  bucket = aws_s3_bucket.request_bucket.id

  rule {
    id     = "delete_old_requests"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "response_bucket_lifecycle" {
  bucket = aws_s3_bucket.response_bucket.id

  rule {
    id     = "delete_old_responses"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "request_bucket_cors" {
  bucket = aws_s3_bucket.request_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"] # In production, replace with your specific domain
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_cors_configuration" "response_bucket_cors" {
  bucket = aws_s3_bucket.response_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"] # In production, replace with your specific domain
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_cors_configuration" "frontend_bucket_cors" {
  bucket = aws_s3_bucket.frontend_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"] # In production, replace with your specific domain
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_dynamodb_table" "user_data" {
  name         = "${var.project_name}-user-data"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "timestamp"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "translation_id"
    type = "S"
  }

  global_secondary_index {
    name            = "TranslationIndex"
    hash_key        = "translation_id"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name        = "User Data Table"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_dynam odb_table" "translation_metadata" {
  name         = "${var.project_name}-translations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "translation_id"

  attribute {
    name = "translation_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  global_secondary_index {
    name            = "UserIndex"
    hash_key        = "user_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name        = "Translation Metadata Table"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role-${random_string.suffix.result}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "Lambda Execution Role"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_policy" "lambda_policy" {
  name        = "${var.project_name}-lambda-policy-${random_string.suffix.result}"
  description = "Policy for Lambda function to access S3, Translate, and CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.request_bucket.arn}/*",
          "${aws_s3_bucket.response_bucket.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.request_bucket.arn,
          aws_s3_bucket.response_bucket.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "translate:TranslateText",
          "translate:DescribeTextTranslationJob",
          "translate:StartTextTranslationJob",
          "translate:StopTextTranslationJob",
          "translate:GetTerminology",
          "translate:ListTerminologies"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_dynamodb_policy" {
  name        = "${var.project_name}-lambda-dynamodb-policy-${random_string.suffix.result}"
  description = "Policy for Lambda function to access DynamoDB"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.user_data.arn,
          aws_dynamodb_table.translation_metadata.arn,
          "${aws_dynamodb_table.user_data.arn}/index/*",
          "${aws_dynamodb_table.translation_metadata.arn}/index/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_dynamodb_policy.arn
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/../lambda/lambda_deployment.zip"
  excludes    = ["*.pyc", "__pycache__", "*.zip"]
}

resource "aws_cloudwatch_log_group" "lambda_log_group" {
  name              = "/aws/lambda/${var.project_name}-translate-function"
  retention_in_days = 7

  tags = {
    Name        = "Lambda Log Group"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_lambda_function" "translate_function" {
  filename      = data.archive_file.lambda_zip.output_path
  function_name = "${var.project_name}-translate-function"
  role          = aws_iam_role.lambda_role.arn
  handler       = "translate_function.lambda_handler"
  runtime       = "python3.9"
  timeout       = 60
  memory_size   = 256

  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      REQUEST_BUCKET    = aws_s3_bucket.request_bucket.bucket
      RESPONSE_BUCKET   = aws_s3_bucket.response_bucket.bucket
      USER_DATA_TABLE   = aws_dynamodb_table.user_data.name
      TRANSLATION_TABLE = aws_dynamodb_table.translation_metadata.name
      REGION            = data.aws_region.current.name
    }
  }

  tags = {
    Name        = "Translation Function"
    Environment = var.environment
    Project     = var.project_name
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_policy_attachment,
    aws_iam_role_policy_attachment.lambda_dynamodb_policy_attachment,
    aws_cloudwatch_log_group.lambda_log_group
  ]
}

resource "aws_lambda_permission" "allow_bucket" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.translate_function.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.request_bucket.arn
}

resource "aws_s3_bucket_notification" "request_bucket_notification" {
  bucket = aws_s3_bucket.request_bucket.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.translate_function.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = ""
    filter_suffix       = ".json"
  }

  depends_on = [aws_lambda_permission.allow_bucket]
}

resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  user_pool_add_ons {
    advanced_security_mode = "OFF"
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  schema {
    name                = "preferred_username"
    attribute_data_type = "String"
    required            = false
    mutable             = true
  }

  tags = {
    Name        = "User Pool"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project_name}-user-pool-client"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  access_token_validity         = 24
  id_token_validity             = 24
  refresh_token_validity        = 30
  prevent_user_existence_errors = "ENABLED"
}

resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.project_name}-identity-pool"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id     = aws_cognito_user_pool_client.main.id
    provider_name = aws_cognito_user_pool.main.endpoint
  }

  tags = {
    Name        = "Identity Pool"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_role" "authenticated_role" {
  name = "${var.project_name}-authenticated-role-${random_string.suffix.result}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "Authenticated User Role"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_policy" "authenticated_policy" {
  name        = "${var.project_name}-authenticated-policy-${random_string.suffix.result}"
  description = "Policy for authenticated users"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.request_bucket.arn}/*",
          "${aws_s3_bucket.response_bucket.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.request_bucket.arn,
          aws_s3_bucket.response_bucket.arn
        ]
        Condition = {
          StringLike = {
            "s3:prefix" = ["public/*", "private/$${cognito-identity.amazonaws.com:sub}/*"]
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = "${aws_api_gateway_rest_api.translate_api.execution_arn}/*/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "authenticated_policy_attachment" {
  role       = aws_iam_role.authenticated_role.name
  policy_arn = aws_iam_policy.authenticated_policy.arn
}

resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    "authenticated" = aws_iam_role.authenticated_role.arn
  }
}

resource "aws_api_gateway_rest_api" "translate_api" {
  name        = "${var.project_name}-translate-api"
  description = "API Gateway for translation service"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name        = "Translation API"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_api_gateway_resource" "translate_resource" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  parent_id   = aws_api_gateway_rest_api.translate_api.root_resource_id
  path_part   = "translate"
}

resource "aws_api_gateway_method" "translate_method" {
  rest_api_id   = aws_api_gateway_rest_api.translate_api.id
  resource_id   = aws_api_gateway_resource.translate_resource.id
  http_method   = "POST"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_method" "translate_options" {
  rest_api_id   = aws_api_gateway_rest_api.translate_api.id
  resource_id   = aws_api_gateway_resource.translate_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "translate_integration" {
  rest_api_id             = aws_api_gateway_rest_api.translate_api.id
  resource_id             = aws_api_gateway_resource.translate_resource.id
  http_method             = aws_api_gateway_method.translate_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.translate_function.invoke_arn
}

resource "aws_api_gateway_integration" "translate_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  resource_id = aws_api_gateway_resource.translate_resource.id
  http_method = aws_api_gateway_method.translate_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "translate_response" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  resource_id = aws_api_gateway_resource.translate_resource.id
  http_method = aws_api_gateway_method.translate_method.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
  }
}

resource "aws_api_gateway_method_response" "translate_options_response" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  resource_id = aws_api_gateway_resource.translate_resource.id
  http_method = aws_api_gateway_method.translate_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
  }
}

resource "aws_api_gateway_integration_response" "translate_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  resource_id = aws_api_gateway_resource.translate_resource.id
  http_method = aws_api_gateway_method.translate_method.http_method
  status_code = aws_api_gateway_method_response.translate_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT'"
  }

  depends_on = [aws_api_gateway_integration.translate_integration]
}

resource "aws_api_gateway_integration_response" "translate_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  resource_id = aws_api_gateway_resource.translate_resource.id
  http_method = aws_api_gateway_method.translate_options.http_method
  status_code = aws_api_gateway_method_response.translate_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT'"
  }

  depends_on = [aws_api_gateway_integration.translate_options_integration]
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.translate_function.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.translate_api.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "translate_deployment" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id

  depends_on = [
    aws_api_gateway_method.translate_method,
    aws_api_gateway_method.translate_options,
    aws_api_gateway_integration.translate_integration,
    aws_api_gateway_integration.translate_options_integration,
    aws_api_gateway_method_response.translate_response,
    aws_api_gateway_method_response.translate_options_response,
    aws_api_gateway_integration_response.translate_integration_response,
    aws_api_gateway_integration_response.translate_options_integration_response
  ]

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.translate_resource.id,
      aws_api_gateway_method.translate_method.id,
      aws_api_gateway_method.translate_options.id,
      aws_api_gateway_integration.translate_integration.id,
      aws_api_gateway_integration.translate_options_integration.id
    ]))
  }
}

resource "aws_api_gateway_stage" "translate_stage" {
  deployment_id = aws_api_gateway_deployment.translate_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.translate_api.id
  stage_name    = var.environment

  tags = {
    Name        = "Translation API Stage"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudfront_origin_access_control" "frontend_oac" {
  name                              = "${var.project_name}-frontend-oac"
  description                       = "OAC for frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend_distribution" {
  origin {
    domain_name              = aws_s3_bucket.frontend_bucket.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend_bucket.bucket}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_oac.id
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend_bucket.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  ordered_cache_behavior {
    path_pattern           = "/service-worker.js"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend_bucket.bucket}"
    compress               = false
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
      headers = ["Content-Type"]
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 300
  }

  ordered_cache_behavior {
    path_pattern           = "/static/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend_bucket.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 86400
    default_ttl = 86400
    max_ttl     = 31536000
  }

  ordered_cache_behavior {
    path_pattern           = "/manifest.json"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend_bucket.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
      headers = ["Content-Type"]
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name        = "Frontend Distribution"
    Environment = var.environment
    Project     = var.project_name
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
}

resource "aws_s3_bucket_policy" "frontend_bucket_policy" {
  bucket = aws_s3_bucket.frontend_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend_bucket.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend_distribution.arn
          }
        }
      }
    ]
  })
}