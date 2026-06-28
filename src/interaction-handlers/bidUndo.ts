import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, type ButtonInteraction } from 'discord.js';
import { Constants } from '../config/constants';
import { Database } from '../state/state';

const UNDO_PREFIX = `${Constants.BUTTON_IDS.BID_UNDO}:`;

interface ParseResult {
  bidId: number;
}

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ButtonHandler extends InteractionHandler {
  public async run(interaction: ButtonInteraction, { bidId }: ParseResult) {
    const bid = Database.getBid(bidId);
    if (!bid || bid.reverted_at != null) {
      return interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: 'This bid has already been reverted or could not be found.',
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`${Constants.BUTTON_IDS.BID_UNDO_REASON}:${bidId}`)
      .setTitle(`Undo Bid #${bidId}`)
      .addLabelComponents(
        new LabelBuilder()
          .setLabel('Reason for reverting this bid')
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId('undo_reason')
              .setPlaceholder('Explain why this bid is being reverted')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMinLength(3)
              .setMaxLength(500),
          ),
      );

    return interaction.showModal(modal);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith(UNDO_PREFIX)) return this.none();
    const bidId = parseInt(interaction.customId.slice(UNDO_PREFIX.length), 10);
    if (Number.isNaN(bidId)) return this.none();
    return this.some({ bidId });
  }
}
