import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, type ButtonInteraction, type GuildMember } from 'discord.js';
import { Constants } from '../config/constants';
import { MemberCacheManagerInstance } from '../state/state';
import { MemberStatusMessageComponents } from '../utils/messageComponentUtil';

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction) {
    if (!interaction.inGuild) return;
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const discordMember = interaction.member as GuildMember;
    const memberName = discordMember.nickname || discordMember.displayName || discordMember.user.username;
    const memberList = await MemberCacheManagerInstance.getMemberList();
    const member = memberList?.find((m) => m.Who.toLowerCase().trim() === memberName.toLowerCase().trim());
    if (!member) {
      return await interaction.editReply({
        content: `Sorry, I couldn't find a member with the name ${memberName}. Please try again.`,
      });
    }
    return await interaction.editReply({
      flags: [MessageFlags.IsComponentsV2],
      components: [MemberStatusMessageComponents(member)],
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (interaction.customId !== Constants.BUTTON_IDS.CHECK_STATUS) return this.none();
    return this.some();
  }
}
