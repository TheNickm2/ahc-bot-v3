import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { Constants } from '../config/constants';

@ApplyOptions<Command.Options>({
  description: 'Roll a die with the specified number of sides (Default 6)',
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addIntegerOption((option) => option.setName('sides').setDescription('Number of sides on the die (Default 6)'))
          .addIntegerOption((option) => option.setName('qty').setDescription('Number of dice to roll (Default 1)')),
      {
        guildIds: Constants.DEFAULT_GUILD_IDS,
      },
    );
  }

  private randomInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
  private getResponseString(qty: number, sides: number) {
    let results = '';
    for (let i = 0; i < qty; i++) {
      const result = this.randomInteger(1, sides);
      const resultString = `\`Roll ${i + 1}\`: **${result}**\n`;
      results += resultString;
    }
    return results;
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply();
    const qty = Number(interaction.options.getInteger('qty', false) || 1);
    const sides = Number(interaction.options.getInteger('sides', false) || 6);

    const resultString = this.getResponseString(qty, sides);

    return await interaction.editReply({
      content: `__Rolled ${qty} x d**${sides}**__... ${Constants.EMOTES.DICE}\n\n${resultString}`,
    });
  }
}
