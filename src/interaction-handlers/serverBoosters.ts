import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction) {
    if (!interaction.inGuild) return;
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    await guild?.members.fetch();
    await guild?.roles.fetch();
    const role = guild?.roles.premiumSubscriberRole;
    if (!role) {
      return await interaction.editReply({
        content: 'An error occurred while fetching the server boosters role. Please try again later.',
      });
    }
    const memberList = role.members.sort((a, z) => (a.displayName > z.displayName ? 1 : -1));
    const boostersListString = memberList.reduce((acc, member) => {
      return `${acc}\n${Constants.EMOTES.SERVER_BOOST} ${member.toString()}`;
    }, '');
    return await interaction.editReply({
      content: `HUGE THANK YOU to our server boosters, listed below:${boostersListString}\n\nMany of the great features of our Discord server would be impossible to use without the support of these amazing server boosters!`,
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (interaction.customId !== Constants.BUTTON_IDS.SERVER_BOOSTERS) return this.none();
    return this.some();
  }
}
