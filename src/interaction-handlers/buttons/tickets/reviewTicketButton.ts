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
  ModalBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
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
    return interaction.customId.startsWith('review-ticket-')
      ? this.some()
      : this.none();
  }

  public async run(interaction: ButtonInteraction) {
    const ticketId = interaction.customId.split('-')[2];
    const maria = await getMariaConnection();

    const [ticket] = await maria.query('SELECT * FROM support_tickets WHERE id = ?', [
      ticketId,
    ]);

    if (!ticket) {
      maria.release();
      return this.replyError(interaction, 'Ticket not found');
    }

    const [review] = await maria.query(
      'SELECT * FROM support_ticket_ratings WHERE ticket_id = ?',
      [ticketId]
    );

    if (review) {
      maria.release();
      return this.replyError(
        interaction,
        'You have already reviewed this ticket'
      );
    }

    maria.release();
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`review-ticket-modal-${ticketId}`)
        .setTitle('Review Ticket')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('rating')
              .setLabel('How would you rate the support you received?')
              .setStyle(TextInputStyle.Short)
              .setMinLength(1)
              .setMaxLength(1)
              .setPlaceholder('1-5')
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('comment')
              .setLabel('Do you have any comments?')
              .setStyle(TextInputStyle.Paragraph)
              .setMinLength(1)
              .setPlaceholder('Optional')
          )
        )
    );
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
      flags: MessageFlags.Ephemeral,
    });
  }
}
