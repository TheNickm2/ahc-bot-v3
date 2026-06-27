import { ContainerBuilder, MessageFlags } from 'discord.js';

/**
 *
 * Wraps plain text in a ContainerBuilder for components-v2 replies.
 * The `content` field is forbidden when a message is already in components-v2
 * mode (e.g. after deferUpdate on a components-v2 ephemeral or DM).
 *
 * @export
 * @param {string} text
 * @return {flags: [MessageFlags.IsComponentsV2], components: [ContainerBuilder]}
 */
export function textReply(text: string) {
  return {
    flags: [MessageFlags.IsComponentsV2] as [MessageFlags.IsComponentsV2],
    components: [new ContainerBuilder().addTextDisplayComponents((t) => t.setContent(text))],
  };
}
