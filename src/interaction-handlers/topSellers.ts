import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { MemberCacheManagerInstance } from '../state/state';
import { TopSellersEmbed } from '../utils/embedUtil';

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const topSellers = await MemberCacheManagerInstance.getTopSellers();
    if (!topSellers || topSellers.size === 0) {
      return interaction.editReply({
        content: 'An error occurred while fetching the top sellers list. Please try again later, or notify an Officer if the issue persists!',
      });
    }
    const embed = TopSellersEmbed(topSellers);
    await interaction.deleteReply();
    return await interaction.followUp({
      embeds: [embed],
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (interaction.customId !== Constants.BUTTON_IDS.TOP_SELLERS) return this.none();
    return this.some();
  }
}
