import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  GuildTextBasedChannel,
  MessageFlags,
  TextChannel,
  type ButtonInteraction,
} from 'discord.js';
import { createEmbed } from '../../../utilities/embed';
import emojis from '../../../utilities/emojis.json' assert { type: 'json' };
import { getMariaConnection } from '../../../services/mariadb';

export class ReopenTicketButton extends InteractionHandler {
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
    return interaction.customId === 'reopen-ticket' ? this.some() : this.none();
  }

  public async run(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    if (!interaction.channel) {
      console.error(
        `[ReopenTicketButton] No channel found for interaction: ${interaction.id}`
      );
      return;
    }

    const member = interaction.member as GuildMember;

    if (!member || !(member instanceof GuildMember)) {
      console.error(
        `[ReopenTicketButton] Invalid member object for interaction: ${interaction.id}`
      );
      return this.replyError(
        interaction,
        'Something went wrong, please try again later.'
      );
    }

    if (!member.roles.cache.has(this.requiredRole)) {
      console.warn(
        `[ReopenTicketButton] Unauthorized attempt to reopen ticket by ${member.user.tag}`
      );
      return this.replyError(
        interaction,
        'Only staff members can reopen tickets.'
      );
    }

    const maria = await getMariaConnection();

    const channel = interaction.channel as TextChannel;
    const [ticket] = await maria.query(
      'SELECT * FROM support_tickets WHERE channel_id = ?',
      [channel.id]
    );

    if (!ticket) {
      console.error(
        `[ReopenTicketButton] No ticket found for channel: ${channel.id}`
      );
      maria.release();
      return this.replyError(
        interaction,
        'Something went wrong, please try again later.'
      );
    }

    const customer = await interaction.guild?.members.fetch(ticket.customer_id);

    const closedMessage = await interaction.channel.messages.fetch(
      ticket.closed_message_id
    );
    const claimedMessage = await interaction.channel.messages.fetch(
      ticket.claimed_message_id
    );
    const reopenedMessage = await interaction.channel.messages.fetch(
      ticket.reopened_message_id
    );
    const initialMessage = await interaction.channel.messages.fetch(
      ticket.initial_message_id
    );

    if (closedMessage) {
      closedMessage.delete();
    }
    if (claimedMessage) {
      claimedMessage.delete();
    }
    if (reopenedMessage) {
      reopenedMessage.delete();
    }

    await maria.query(
      'UPDATE support_tickets SET staff_id = NULL, claimed_at = NULL, closed_at = NULL, closed_message_id = NULL, claimed_message_id = NULL WHERE channel_id = ?',
      [channel.id]
    );

    channel.setName(
      `ticket-${ticket.ticket_number.toString().padStart(4, '0')}`
    );

    await initialMessage.edit({
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

    let newReopenedMessage = null;
    if (customer && channel.isSendable()) {
      await channel.permissionOverwrites.edit(customer, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
        AddReactions: true,
      });

      newReopenedMessage = await channel.send({
        embeds: [
          createEmbed({
            theme: 'success',
            title: `${emojis.checkmark} Ticket Reopened`,
            text: `The ticket has been reopened.`,
          }),
        ],
      });
    } else if (!customer && channel.isSendable()) {
      console.warn(
        `[ReopenTicketButton] Customer not found for ticket: ${ticket.ticket_number}`
      );
      newReopenedMessage = await channel.send({
        embeds: [
          createEmbed({
            theme: 'success',
            title: `${emojis.checkmark} Ticket Reopened`,
            text: `The ticket has been reopened.`,
            footer: {
              text: `The member who opened the ticket was not found in the server, I've re-opened the ticket anyway.`,
              iconURL: interaction.guild?.iconURL() ?? undefined,
            },
          }),
        ],
      });
    }

    if (newReopenedMessage) {
      await maria.query(
        'UPDATE support_tickets SET reopened_message_id = ? WHERE channel_id = ?',
        [newReopenedMessage.id, channel.id]
      );
    }

    maria.release();
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
