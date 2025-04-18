import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
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
    if (interaction.customId !== 'create-ticket-modal') return this.none();
    return this.some();
  }

  public async run(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const problemDescription = interaction.fields.getTextInputValue(
      'problem-description'
    );
    const categoryAndSeverity =
      await getCategoryAndSeverity(problemDescription);
    if (!categoryAndSeverity) {
      await interaction.editReply({
        embeds: [
          createEmbed({
            theme: 'failure',
            title: `${emojis.nocross} Error`,
            text: 'Something went wrong, please try again later.',
          }),
        ],
      });
      return;
    }

    const { category, severity } = categoryAndSeverity;
    const parentChannelId = ticketChannels.channel_ids[category];
    const maria = await getMariaConnection('NovawareDiscord');

    await maria.query(
      'INSERT INTO ticket_counters (category, counter) VALUES (?, 1) ON DUPLICATE KEY UPDATE counter = counter + 1',
      [category]
    );

    const result = await maria.query(
      'SELECT counter FROM ticket_counters WHERE category = ?',
      [category]
    );

    const ticketNumber = result[0].counter.toString().padStart(4, '0');

    const channel = await interaction.guild?.channels.create({
      name: `ticket-${ticketNumber}`,
      parent: parentChannelId,
    });

    if (!channel) {
      maria.release();
      return await interaction.editReply({
        embeds: [
          createEmbed({
            theme: 'failure',
            title: `${emojis.nocross} Error`,
            text: 'Something went wrong, please try again later.',
          }),
        ],
      });
    }

    const initialMessage = await channel.send({
      content: `<@${interaction.user.id}> <@&1361789304187261049>`,
      embeds: [
        createEmbed({
          text: `${welcomeMsgs[category].replace(
            '{{PING}}',
            `<@${interaction.user.id}>`
          )}\n\n**You said:**\n${problemDescription}`,
          theme: 'success',
          color: '#D0A955',
          footer: {
            iconURL: interaction.user.displayAvatarURL(),
            text: `${interaction.user.username}`,
          },
          timestamp: true,
        }),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('close-ticket')
            .setLabel('Close')
            .setEmoji(emojis.white_nocross)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('claim-ticket')
            .setLabel('Claim')
            .setEmoji(emojis.white_checkmark)
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });

    channel.permissionOverwrites.edit(interaction.user, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true,
      AddReactions: true,
    });

    await interaction.editReply({
      embeds: [
        createEmbed({
          title: `${emojis.checkmark} Ticket Created`,
          text: `You can access it here: <#${channel.id}>`,
          theme: 'success',
        }),
      ],
    });

    await maria.query(
      'INSERT INTO support_tickets (customer_id, category, channel_id, ticket_number, initial_message_id) VALUES (?, ?, ?, ?, ?)',
      [
        interaction.user.id,
        category,
        channel.id,
        ticketNumber,
        initialMessage.id,
      ]
    );

    maria.release();
  }
}
