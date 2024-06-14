export const Constants = {
	DEFAULT_GUILD_IDS: process.env.DEFAULT_GUILD_IDS?.split(',').map((id) => id.trim()),
	EMOTES: {
		COIN: '<a:coin:726992358251561091>',
		CHECK: '<a:check:918626532438704129>',
		CANCEL: '<a:cancel:942601332567715860>',
		LIST_ITEM: '<:purpledash:966210158990610433>',
		INFO: '<:info:985035960305745990>',
		SERVER_BOOST: '<a:nitroboostspin:909698016141778966>',
		AHC_BANNER: '<:AHCbanner:975254289888968794>',
		DEV_TESTING: '<:mushuCreep:1070036171792588932>',
		DICE: '<a:dice:954277834845741077>',
	},
	EMBED_COLOR: 0xb072ff,
	EMBED_AUTHOR_ICON: 'https://media.discordapp.net/attachments/925942369965191208/983420398232289370/Animated_Logo_500x500_px_30.gif',
	TOP_SELLER_THUMBNAIL: 'https://cdn.discordapp.com/emojis/726992358251561091.gif',
	AHC_BANNER_IMAGE: 'https://media.discordapp.net/stickers/975254619657756702.png',
	INFO_CENTER_LINK: 'https://ahf.gg/',
	BUTTON_IDS: {
		START_AUCTION: 'start-auction',
		TOP_SELLERS: 'top-sellers',
		CHECK_STATUS: 'check-status',
		SERVER_BOOSTERS: 'server-boosters',
		REROLL_DICE: 'reroll-dice',
	},
};
