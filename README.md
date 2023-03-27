# arstotzka

## commander.Dockerfile

- COMMAND: a `package.json` script name of one or more of the selected `SCOPES`
- SCOPES: a list of packages for the `COMMAND` to run in

the following will be invoked:
`lerna run $COMMAND --scope=$SCOPES`

## migrations
```
docker run -e COMMAND=seed -e SCOPES=registry,locky,actiony arstotzka-commander:latest
```

## seed
```
docker run -e COMMAND=seed -e SCOPES=registry arstotzka-commander:latest
```