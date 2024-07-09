import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import { MemberCacheManagerInstance } from '../state/state';
import { Constants } from '../config/constants';
import { Stopwatch } from '@sapphire/stopwatch';

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction) {
    await interaction.deferReply({
      ephemeral: true,
    });
    const stopwatch = new Stopwatch();
    await MemberCacheManagerInstance.refreshCache();
    const duration = stopwatch.stop().toString();
    await interaction.editReply({
      content: `Successfully refreshed sheet data in ${duration}`,
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (interaction.customId !== Constants.BUTTON_IDS.REFRESH_SHEETS) return this.none();
    return this.some();
  }
}
