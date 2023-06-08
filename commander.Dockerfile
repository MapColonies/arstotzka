FROM node:16

WORKDIR /usr/app
COPY . .
RUN npm install

CMD sh -c 'npx lerna run $COMMAND --scope='{$SCOPES}''
