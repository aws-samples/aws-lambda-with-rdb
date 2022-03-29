import { Construct } from 'constructs';
import { Duration, CfnOutput } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { DBSettings } from '../bin/db-settings';

export interface DatabaseProps {
  vpc: ec2.IVpc;
  dbSettings: DBSettings;
}

// Define DB related resources

export class Database extends Construct {
  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    const databaseName = 'prototype';
    const engine = ((dbFamily) => {
      if (dbFamily === 'MYSQL') {
        return rds.DatabaseClusterEngine.auroraMysql({
          version: rds.AuroraMysqlEngineVersion.VER_5_7_12,
        });
      } else if (dbFamily === 'POSTGRESQL') {
        return rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_13_4,
        });
      } else {
        const check: never = dbFamily;
        return check;
      }
    })(props.dbSettings.dbFamily);

    const dbCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: engine,
      defaultDatabaseName: databaseName,
      instances: 1,
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      },
      storageEncrypted: true,
    });

    dbCluster.connections.allowDefaultPortFrom(ec2.Peer.ipv4(props.vpc.vpcCidrBlock));

    const secret = dbCluster.secret!;

    new ec2.InterfaceVpcEndpoint(this, 'VpcEndpoint', {
      vpc: props.vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });

    const dbDefiner = new lambda.DockerImageFunction(this, 'DbDefiner', {
      code: lambda.DockerImageCode.fromImageAsset('lambda/db-definer'),
      memorySize: 256,
      timeout: Duration.seconds(300),
      vpc: props.vpc,
      environment: {
        DB_SECRET_NAME: secret.secretName,
        DB_ENGINE_FAMILY: dbCluster.engine?.engineFamily!,
        DB_NAME: databaseName,
      },
    });
    secret.grantRead(dbDefiner);

    new CfnOutput(this, 'DBLambdaName', { value: dbDefiner.functionName });
  }
}
