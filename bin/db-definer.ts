#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DbDefinerStack } from '../lib/db-definer-stack';
import { DBSettings } from './db-settings';

const app = new cdk.App();

const dbSettings: DBSettings = {
  dbFamily: 'MYSQL',
};

new DbDefinerStack(app, 'DbDefinerStack', { dbSettings });
