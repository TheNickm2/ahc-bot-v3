export const Constants = {
	DEFAULT_GUILD_IDS: process.env.DEFAULT_GUILD_IDS?.split(',').map((id) => id.trim()),
	EMOTES: {
		COIN: '<a:coin:726992358251561091>',
		CHECK: '<a:check:918626532438704129>',
		CANCEL: '<a:cancel:942601332567715860>',
		LIST_ITEM: '<:purpledash:966210158990610433>',
		INFO: '<:info:985035960305745990>',
		SERVER_BOOST: '<a:nitroboostspin:909698016141778966>',
		AHC_BANNER: '<:ahcBannerUnicorn:1252453336901488671>',
		DEV_TESTING: '<:mushuCreep:1070036171792588932>',
		DICE: '<a:dice:954277834845741077>',
	},
	EMBED_COLOR: 0xb072ff,
	EMBED_AUTHOR_ICON: 'https://media.discordapp.net/attachments/925942369965191208/983420398232289370/Animated_Logo_500x500_px_30.gif',
	TOP_SELLER_THUMBNAIL: 'https://media.discordapp.net/attachments/944039646000721921/1252452760331489360/vinnygoldtwinkle.gif',
	AHC_BANNER_IMAGE: 'https://media.discordapp.net/attachments/1053151598504837122/1251746344574521384/nicornbannerribbons.png',
	INFO_CENTER_LINK: 'https://ahf.gg/',
	BUTTON_IDS: {
		START_AUCTION: 'start-auction',
		TOP_SELLERS: 'top-sellers',
		CHECK_STATUS: 'check-status',
		SERVER_BOOSTERS: 'server-boosters',
		REROLL_DICE: 'reroll-dice',
		REFRESH_SHEETS: 'refresh-sheets',
	},
};
