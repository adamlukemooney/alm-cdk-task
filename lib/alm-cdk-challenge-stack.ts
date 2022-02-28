import { RemovalPolicy, Stack, StackProps, aws_s3 as S3 } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class AlmCdkChallengeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucket = new S3.Bucket(this, 'alm-cdk-challenge-bucket', {
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    const lambda = new NodejsFunction(
      this,
      'alm-cdk-challenge-handler',
      {
        environment: {
          S3_BUCKET: bucket.bucketName
        },
        entry: './code/handler.ts'
      }
    )

    bucket.grantReadWrite(lambda)

    const restApi = new RestApi(this, 'alm-cdk-challenge-api-gateway')

    const filesResource = restApi.root.addResource('v0').addResource('files')
    filesResource.addMethod('GET', new LambdaIntegration(lambda))

    const fileResource = filesResource.addResource("{id}")
    fileResource.addMethod('POST', new LambdaIntegration(lambda))
    fileResource.addMethod('GET', new LambdaIntegration(lambda))
    fileResource.addMethod('DELETE', new LambdaIntegration(lambda))
  }
}
