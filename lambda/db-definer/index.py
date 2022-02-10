import os
import json
import glob
import subprocess
from subprocess import CalledProcessError
from sqlalchemy import create_engine, text
from sqlalchemy_utils.functions import drop_database, create_database, database_exists
import sqlparse
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities import parameters

LAMBDA_TASK_ROOT = os.environ['LAMBDA_TASK_ROOT']
command_list = ['init', 'preview', 'sync', 'seed']
logger = Logger(service='db-definer')
secret_name = os.environ['DB_SECRET_NAME']
secret = json.loads(parameters.get_secret(secret_name, max_age=60))


class InvalidCommandError(Exception):
    """
    Exception raised if 'event.command' is invalid.
    """
    pass


class SqldefError(Exception):
    """
    Exception raised if 'sqldef' throw error.
    """
    pass


class InvalidDatabaseError(Exception):
    """
    Exception raised if Database Engine are invalid.
    """
    pass


class Database:
    hostname = secret['host']
    port = str(secret['port'])
    user = secret['username']
    password = secret['password']
    db_name = secret['dbname']
    table_def = '/tmp/table_def.sql'

    def __init__(self, dialect, ddl_file_path):
        self.dialect = dialect
        if self.dialect == 'POSTGRESQL':
            self.sqldef_command = [f'{LAMBDA_TASK_ROOT}/psqldef',
                                   '-U', self.user,
                                   '-h', self.hostname,
                                   '-p', self.port,
                                   '-W', self.password, self.db_name,
                                   '-f']
            self.url = f'{self.dialect.lower()}://{self.user}:{self.password}@{self.hostname}:{self.port}/{self.db_name}'
        elif self.dialect == 'MYSQL':
            self.sqldef_command = [f'{LAMBDA_TASK_ROOT}/mysqldef',
                                   '-u', self.user,
                                   '-h', self.hostname,
                                   '-P', self.port,
                                   '-p', self.password, self.db_name,
                                   '--file']
            self.url = f'{self.dialect.lower()}+pymysql://{self.user}:{self.password}@{self.hostname}:{self.port}/{self.db_name}'
        else:
            raise InvalidDatabaseError('Only MySQL or PostgreSQL are available.')

        ddl_file_list = glob.glob(f'{ddl_file_path}/*')

        with open(self.table_def, 'w') as new_file:
            for sql_file in ddl_file_list:
                new_file.write(open(sql_file, 'r').read())

    def run_sqldef(self):
        """
        Reflect changes in the table definition by using 'sqldef'.
        WARNING:
            The table will be dropped if that table of DDL is deleted.
            It's highly recomended that you run 'preview_sqldef' before this command.
        """
        result = subprocess.run([*self.sqldef_command, self.table_def], capture_output=True)
        try:
            result.check_returncode()
        except CalledProcessError:
            raise SqldefError(result.stderr.decode())

        return result.stdout.decode()

    def preview_sqldef(self):
        """
        Show SQL script that will be ran by 'sqldef'.
        """
        result = subprocess.run([*self.sqldef_command, self.table_def, '--dry-run'], capture_output=True)
        try:
            result.check_returncode()
        except CalledProcessError:
            raise SqldefError(result.stderr.decode())

        return result.stdout.decode()

    def run_query_from_file(self, path):
        """
        Run SQL file by using 'sqlalchemy'.
        """
        engine = create_engine(self.url)

        file_list = glob.glob(f'{path}/*')
        with engine.begin() as connection:
            for file in file_list:
                for query in sqlparse.split(open(file, 'r').read()):
                    connection.execute(text(query))

    def drop_and_create_database(self):
        if database_exists(self.url):
            drop_database(self.url)
        create_database(self.url)


@logger.inject_lambda_context(log_event=True)
def handler(event, context):
    ddl_file_path = './schema'
    command = event.get('command')
    if command not in command_list:
        raise InvalidCommandError('Please send events such as {"command": "init"|"preview"|"sync"|"seed"}')
    db_engine_family = os.environ['DB_ENGINE_FAMILY']
    database = Database(db_engine_family, ddl_file_path)
    if command == 'init':
        database.drop_and_create_database()

    if command == 'init' or command == 'sync':
        result = database.run_sqldef()

    if command == 'preview':
        result = database.preview_sqldef()

    if command == 'seed':
        if db_engine_family == 'MYSQL':
            database.run_query_from_file('./seed/mysql')
        elif db_engine_family == 'POSTGRESQL':
            database.run_query_from_file('./seed/postgresql')
        result = 'seed was succeeded.'

    return result
