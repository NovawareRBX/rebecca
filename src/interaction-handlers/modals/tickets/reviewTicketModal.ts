import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  TextChannel,
  type ModalSubmitInteraction,
} from 'discord.js';
import { getCategoryAndSeverity } from '../../../services/ai/AIService';
import { createEmbed } from '../../../utilities/embed';
import emojis from '../../../utilities/emojis.json' assert { type: 'json' };
import ticketChannels from '../../../utilities/tickets/ticket_channels.json';
import { getMariaConnection } from '../../../services/mariadb';

import generalSupportWelcomeMsg from '../../../utilities/tickets/category_welcome_msgs/general_support.txt';
import gameIssuesWelcomeMsg from '../../../utilities/tickets/category_welcome_msgs/game_issues.txt';
import userReportsWelcomeMsg from '../../../utilities/tickets/category_welcome_msgs/user_reports.txt';
import staffReportsManagementWelcomeMsg from '../../../utilities/tickets/category_welcome_msgs/staff_reports_management.txt';

const welcomeMsgs = {
  general_support: generalSupportWelcomeMsg,
  game_issues: gameIssuesWelcomeMsg,
  user_reports: userReportsWelcomeMsg,
  staff_reports_management: staffReportsManagementWelcomeMsg,
};

export class CreateTicketModalHandler extends InteractionHandler {
  public constructor(
    ctx: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options
  ) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
    });
  }

  public override parse(interaction: ModalSubmitInteraction) {
    return interaction.customId.startsWith('review-ticket-modal-')
      ? this.some()
      : this.none();
  }

  public async run(interaction: ModalSubmitInteraction) {
    const ticketId = interaction.customId.split('-')[3];
    const rating = interaction.fields.getTextInputValue('rating');
    const comment = interaction.fields.getTextInputValue('comment');

    if (isNaN(Number(rating)))
      return interaction.reply({
        embeds: [
          createEmbed({
            theme: 'failure',
            title: `${emojis.nocross} Error`,
            text: 'Your rating must be a number between 1 and 5!',
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });

    // check if the review already exists
    const maria = await getMariaConnection();
    const [review] = await maria.query(
      'SELECT * FROM support_ticket_ratings WHERE ticket_id = ?',
      [ticketId]
    );
    if (review) {
      maria.release();
      return interaction.reply({
        embeds: [
          createEmbed({
            theme: 'failure',
            title: `${emojis.nocross} Error`,
            text: 'You have already reviewed this ticket!',
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const [ticket] = await maria.query(
      'SELECT * FROM support_tickets WHERE id = ?',
      [ticketId]
    );

    if (!ticket) {
      maria.release();
      return interaction.reply({
        embeds: [
          createEmbed({
            theme: 'failure',
            title: `${emojis.nocross} Error`,
            text: 'Ticket not found!',
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // insert the review
    await maria.query(
      'INSERT INTO support_ticket_ratings (ticket_id, rating, review) VALUES (?, ?, ?)',
      [ticketId, rating, comment]
    );
    maria.release();
    interaction.reply({
      embeds: [
        createEmbed({
          theme: 'success',
          title: `${emojis.checkmark} Review submitted`,
          text: 'Thank you for your feedback!',
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });

    const channel = (await interaction.client.channels.fetch(
      '1362559684841574501'
    )) as TextChannel;
    const transcript_message = await channel.messages.fetch(
      ticket.transcript_message_id
    );

    if (transcript_message) {
      const embed = transcript_message.embeds[0];
      embed.fields.push({
        name: 'Review',
        value: `Rating: ${rating}\nReview: ${comment}`,
        inline: false,
      });
      await transcript_message.edit({ embeds: [embed] });
    }
  }
}
