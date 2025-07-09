FROM node:16

WORKDIR /usr/app
COPY . .
RUN npm install

RUN npx lerna run build

CMD sh -c 'npx lerna run $COMMAND --scope='{$SCOPES}''
