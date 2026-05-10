import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';
import { Construct } from 'constructs';
import { DeploymentConfig } from './config';

export interface GlobalStackProps extends cdk.StackProps {
  config: DeploymentConfig;
  s3BucketArn: string;
  s3BucketDomainName: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  apiUrl: string;
}

export class GlobalStack extends cdk.Stack {
  public readonly distributionDomainName: string;
  public readonly allowedOrigin: string;

  constructor(scope: Construct, id: string, props: GlobalStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Import the S3 bucket from the RegionalStack
    const websiteBucket = s3.Bucket.fromBucketAttributes(this, 'ImportedBucket', {
      bucketArn: props.s3BucketArn,
      bucketRegionalDomainName: props.s3BucketDomainName,
    });

    // --- Task 5.1: CloudFront Distribution with S3 OAC origin ---
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(websiteBucket);

    // --- Task 5.2: Optional custom domain and ACM certificate ---
    const distributionProps: cloudfront.DistributionProps = {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    };

    if (config.customDomain) {
      const certificate = certificatemanager.Certificate.fromCertificateArn(
        this,
        'Certificate',
        config.customDomain.certificateArn,
      );

      Object.assign(distributionProps, {
        domainNames: [config.customDomain.domainName],
        certificate,
      });
    }

    const distribution = new cloudfront.Distribution(this, 'Distribution', distributionProps);

    this.distributionDomainName = distribution.distributionDomainName;

    // --- Task 5.5: Determine the allowed origin URL ---
    this.allowedOrigin = config.customDomain
      ? `https://${config.customDomain.domainName}`
      : `https://${distribution.distributionDomainName}`;

    // --- Task 5.3: Generate runtime-config.json ---
    const runtimeConfig: Record<string, unknown> = {
      userPoolId: props.cognitoUserPoolId,
      clientId: props.cognitoClientId,
      region: config.primaryRegion,
      apiEndpoint: props.apiUrl,
      emailRestriction: {
        enabled: config.emailRestriction.enabled,
        ...(config.emailRestriction.enabled && config.emailRestriction.allowedDomains && {
          allowedDomains: config.emailRestriction.allowedDomains,
        }),
      },
    };

    // --- Task 5.4: S3 BucketDeployment for frontend assets + runtime-config.json ---
    new s3deploy.BucketDeployment(this, 'DeployFrontendAssets', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../frontend')),
        s3deploy.Source.jsonData('runtime-config.json', runtimeConfig),
      ],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // --- Task 5.5: Output the allowed origin for reference ---
    new cdk.CfnOutput(this, 'AllowedOrigin', {
      value: this.allowedOrigin,
      description: 'The allowed CORS origin URL (CloudFront or custom domain)',
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID',
    });
  }
}
