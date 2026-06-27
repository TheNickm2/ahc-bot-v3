import { ContainerBuilder, MessageFlags } from 'discord.js';

/**
 * Returns the file name and line number of the calling site.
 * Requires `source-map-support` to be registered at startup so that TypeScript
 * source locations are reported instead of compiled JavaScript locations.
 *
 * @returns A string in the form `filename.ts:lineNumber`, e.g. `quickBid.ts:22`.
 */
export function getCallerLocation(): string {
  const stack = new Error().stack?.split('\n');
  // stack[0] = "Error", stack[1] = getCallerLocation, stack[2] = the actual caller
  const line = stack?.[2] ?? '';
  const match = line.match(/\((.+):(\d+):\d+\)/) ?? line.match(/at (.+):(\d+):\d+/);
  if (!match) return 'unknown location';
  const fileName = match[1].split('/').pop() ?? match[1];
  return `${fileName}:${match[2]}`;
}

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
