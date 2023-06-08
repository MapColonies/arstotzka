# arstotzka

## commander.Dockerfile

### environment variables:
- COMMAND: the command to be excuted as a `package.json` script name of one or more of the selected `SCOPES`
- SCOPES: a list of packages for the `COMMAND` to run in. comma saperated with no spaces. (currently excuting on a single package will have to be passed with a single comma as suffix e.g. "registry," due to lerna filtering the scope argument)

the following will be invoked:
`lerna run $COMMAND --scope={$SCOPES}`

## migrations
```
docker run -e COMMAND=migration:run -e SCOPES=registry,locky,actiony arstotzka-commander:latest
```

## seed
prepare your namespace seed input file, [see example](packages/registry/namespace-seeder-example.json) and locate it in `$HOME/input.json`

```
docker run -e COMMAND=seed -e SCOPES=registry, -v ~/packages/registry/namespace-seeder-example.json:/root/input.json arstotzka-commander:latest
```
