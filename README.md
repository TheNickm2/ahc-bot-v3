# AHC Bot v3

This is v3 of AHC’s custom Discord bot, built using the [sapphire framework](https://github.com/sapphiredev/framework) written in TypeScript

## How to use it?

### Installation

```sh
npm install
```

### Development

This command will run `tsup --watch --onSuccess \"node ./dist/index.js\"` to watch the files and automatically restart your bot.

```sh
npm run dev
```

### Production

If using CI/CD, your pipeline should `npm run build` and then `npm run start` upon build success. If manually deploying, you can simply chain the commands `npm run build && npm run start` to build and start the bot for production.

## License

See [LICENSE](LICENSE)
