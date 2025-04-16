import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  GuildTextBasedChannel,
  MessageFlags,
  TextChannel,
  type ButtonInteraction,
} from 'discord.js';
import { createEmbed } from '../../../utilities/embed';
import emojis from '../../../utilities/emojis.json' assert { type: 'json' };
import { getMariaConnection } from '../../../services/mariadb';
import saveTranscript from '../../../utilities/tickets/saveTranscript';

export class SaveTranscriptButton extends InteractionHandler {
  private readonly requiredRole = '1277325690664124428';

  public constructor(
    ctx: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options
  ) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  public override parse(interaction: ButtonInteraction) {
    return interaction.customId === 'save-ticket' ? this.some() : this.none();
  }

  public async run(interaction: ButtonInteraction) {
    const maria = await getMariaConnection();

    const [transcript] = await maria.query(
      'SELECT * FROM ticket_transcripts WHERE related_channel_id = ?',
      [interaction.channelId]
    );

    if (transcript)
      return this.replyError(
        interaction,
        `Transcript already exists: [View Online](https://transcripts.frazers.co/ticket/${transcript.transcript_id})`
      );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${emojis.loading} Saving transcript...`)
          .setColor('#738acb'),
      ],
    });

    const uuid = await saveTranscript(
      interaction.client,
      interaction.channelId
    );

    interaction.editReply({
      embeds: [
        createEmbed({
          theme: 'success',
          title: `${emojis.checkmark} Transcript Saved`,
          text: `[View Online](https://trcs.frazers.co/${uuid})`,
        }),
      ],
    });
  }

  private async replyError(interaction: ButtonInteraction, text: string) {
    console.error(`[ReopenTicketButton] Error response: ${text}`);
    await interaction.reply({
      embeds: [
        createEmbed({
          theme: 'failure',
          title: `${emojis.nocross} Error`,
          text,
        }),
      ],
      ephemeral: true,
    });
  }
}
