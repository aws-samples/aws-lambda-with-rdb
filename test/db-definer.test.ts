import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DbDefinerStack } from '../lib/db-definer-stack';

test('Snapshot test (MySQL)', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new DbDefinerStack(app, 'MyTestStack', {
    dbSettings: {
      dbFamily: 'MYSQL',
    },
  });
  // THEN
  const template = Template.fromStack(stack);
  expect(template).toMatchSnapshot();
});

test('Snapshot test (Postgres)', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new DbDefinerStack(app, 'MyTestStack', {
    dbSettings: {
      dbFamily: 'POSTGRESQL',
    },
  });
  // THEN
  const template = Template.fromStack(stack);
  expect(template).toMatchSnapshot();
});
