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
            text: `The ticket has been closed.`,
          }),
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder({
              customId: 'reopen-ticket',
              label: 'Reopen',
              style: ButtonStyle.Secondary,
            }),
            new ButtonBuilder({
              customId: 'save-ticket',
              label: 'Save Transcript',
              style: ButtonStyle.Secondary,
            }),
            new ButtonBuilder({
              customId: 'delete-ticket',
              label: 'Delete',
              style: ButtonStyle.Danger,
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
