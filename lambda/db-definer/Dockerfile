FROM public.ecr.aws/lambda/python:3.9

RUN yum install -y wget gzip tar
RUN wget -O - https://github.com/k0kubun/sqldef/releases/download/v0.11.30/mysqldef_linux_amd64.tar.gz \
    | tar xvz && \
    wget -O - https://github.com/k0kubun/sqldef/releases/download/v0.11.30/psqldef_linux_amd64.tar.gz \
    | tar xvz
COPY ./requirements.txt ./
RUN python3.9 -m pip install -r requirements.txt -t .
COPY ./ ./

CMD ["index.handler"]