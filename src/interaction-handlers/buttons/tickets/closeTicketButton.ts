import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildTextBasedChannel,
  MessageFlags,
  TextChannel,
  type ButtonInteraction,
} from 'discord.js';
import { createEmbed } from '../../../utilities/embed';
import emojis from '../../../utilities/emojis.json' assert { type: 'json' };
import { getMariaConnection } from '../../../services/mariadb';
import saveTranscript from '../../../utilities/tickets/saveTranscript';

export class CreateTicketButton extends InteractionHandler {
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
    return interaction.customId === 'close-ticket' ||
      interaction.customId === 'confirm-close-ticket' ||
      interaction.customId === 'cancel-close-ticket'
      ? this.some()
      : this.none();
  }

  public async run(interaction: ButtonInteraction) {
    if (interaction.customId === 'close-ticket') {
      await this.closePreConfirm(interaction);
    } else if (interaction.customId === 'confirm-close-ticket') {
      await this.closeConfirm(interaction);
    } else if (interaction.customId === 'cancel-close-ticket') {
      await this.cancelClose(interaction);
    }
  }

  private async closeConfirm(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    const maria = await getMariaConnection();
    const channel = interaction.channel as TextChannel;
    const [ticket] = await maria.query(
      'SELECT * FROM support_tickets WHERE channel_id = ?',
      [channel.id]
    );

    if (!ticket) {
      maria.release();
      return this.replyError(interaction, 'This is not a valid ticket.');
    }

    try {
      channel.permissionOverwrites.delete(ticket.customer_id);
    } catch (error) {}

    try {
      channel.setName(
        `closed-${ticket.ticket_number.toString().padStart(4, '0')}`
      );
    } catch (error) {}

    const initialMessage = await interaction.channel?.messages.fetch(
      ticket.initial_message_id
    );
    const reopenedMessage = await interaction.channel?.messages.fetch(
      ticket.reopened_message_id
    );
    if (initialMessage) {
      await initialMessage.edit({
        components: [],
      });
    }
    if (reopenedMessage) {
      await reopenedMessage.delete();
    }

    await interaction.editReply({
      embeds: [
        createEmbed({
          theme: 'success',
          title: `${emojis.checkmark} Ticket Closed`,
          text: 'Please click "Dismiss Message" below.',
        }),
      ],
      components: [],
    });

    let closedMessage = null;
    if (interaction.message.channel.isSendable()) {
      closedMessage = await interaction.message.channel.send({
        embeds: [
          createEmbed({
            theme: 'success',
            title: `${emojis.checkmark} Ticket Closed`,
            text: `The ticket has been closed. Please do not delete this channel until the transcript has been saved!`,
          }),
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            // new ButtonBuilder({
            //   customId: 'reopen-ticket',
            //   label: 'Reopen',
            //   style: ButtonStyle.Secondary,
            // }),
            // new ButtonBuilder({
            //   customId: 'save-ticket',
            //   label: 'Save Transcript',
            //   style: ButtonStyle.Secondary,
            // }),
            new ButtonBuilder({
              customId: 'delete-ticket',
              label: 'Delete',
              style: ButtonStyle.Secondary,
              disabled: true,
            })
          ),
        ],
      });
    }

    await maria.query(
      'UPDATE support_tickets SET closed_at = NOW(), closed_message_id = ?, closed_by = ? WHERE channel_id = ?',
      [closedMessage?.id, interaction.user.id, channel.id]
    );

    maria.release();

    const uuid = await saveTranscript(
      interaction.client,
      interaction.channelId
    );
    if (closedMessage) {
      await closedMessage.edit({
        embeds: [
          createEmbed({
            theme: 'success',
            title: `${emojis.checkmark} Ticket Closed`,
            text: `The ticket has been closed.`,
          }),
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            // new ButtonBuilder({
            //   customId: 'reopen-ticket',
            //   label: 'Reopen',
            //   style: ButtonStyle.Secondary,
            // }),
            // new ButtonBuilder({
            //   customId: 'save-ticket',
            //   label: 'Save Transcript',
            //   style: ButtonStyle.Secondary,
            // }),
            new ButtonBuilder({
              customId: 'delete-ticket',
              label: 'Delete',
              style: ButtonStyle.Secondary,
              disabled: false,
            }),
            new ButtonBuilder({
              label: 'View Transcript',
              style: ButtonStyle.Link,
              url: `https://trcs.frazers.co/${uuid}`,
            })
          ),
        ],
      });
    }

    const customer = await interaction.guild?.members.fetch(ticket.customer_id);
    const components = [];
    let description =
      interaction.member?.user.id === ticket.customer_id
        ? `Thanks for reaching out to Fortune Frenzy support. It looks like you closed this ticket yourself, so we’re hoping that means everything's sorted. If you need anything else, don’t hesitate to open a new ticket.`
        : `Thanks for contacting Fortune Frenzy support. We’ve gone ahead and closed your ticket, and we hope we were able to help get things sorted. If you have more questions, feel free to open a new one anytime.`;

    if (ticket.staff_id) {
      const staff = await interaction.guild?.members.fetch(ticket.staff_id);
      description += `\n\nOur moderator, **${staff?.user.username}**, assisted you with this ticket. Feel free to leave an optional review by clicking the button below.`;

      components.push(
        new ButtonBuilder({
          customId: `review-ticket-${ticket.id}`,
          label: 'Review',
          emoji: '⭐',
          style: ButtonStyle.Secondary,
        })
      );
    }

    if (uuid) {
      components.push(
        new ButtonBuilder({
          label: 'View Transcript',
          style: ButtonStyle.Link,
          url: `https://trcs.frazers.co/${uuid}`,
        })
      );
    }

    if (customer) {
      await customer.send({
        embeds: [
          createEmbed({
            theme: 'success',
            title: `Your ticket (#${ticket.ticket_number.toString().padStart(4, '0')}) has been closed`,
            text: description,
          }),
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(components),
        ],
      });
    }
  }

  private async closePreConfirm(interaction: ButtonInteraction) {
    await interaction.reply({
      embeds: [
        createEmbed({
          theme: 'failure',
          title: `${emojis.nocross} Close Ticket`,
          text: 'Are you sure you want to close this ticket?',
        }),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder({
            customId: 'confirm-close-ticket',
            label: 'Confirm',
            style: ButtonStyle.Secondary,
          }),
          new ButtonBuilder({
            customId: 'cancel-close-ticket',
            label: 'Cancel',
            style: ButtonStyle.Secondary,
          })
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
  }

  private async cancelClose(interaction: ButtonInteraction) {
    await interaction.message.delete();
  }

  private async replyError(interaction: ButtonInteraction, text: string) {
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
