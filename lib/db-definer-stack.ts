import { Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { DBSettings } from '../bin/db-settings';
import { Database } from './database';

interface DbDefinerStackProps extends StackProps {
  dbSettings: DBSettings;
}
export class DbDefinerStack extends Stack {
  constructor(scope: Construct, id: string, props: DbDefinerStackProps) {
    super(scope, id, props);
    const vpc = new ec2.Vpc(this, 'Vpc', {
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'db',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    new Database(this, 'DB', {
      vpc,
      dbSettings: props.dbSettings,
    });
  }
}
