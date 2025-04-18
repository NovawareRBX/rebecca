import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { type ButtonInteraction, GuildMember, TextChannel } from 'discord.js';
import { createEmbed } from '../../../utilities/embed';
import emojis from '../../../utilities/emojis.json' assert { type: 'json' };
import { getMariaConnection } from '../../../services/mariadb';

export class ClaimTicketButton extends InteractionHandler {
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
    return interaction.customId === 'claim-ticket' ? this.some() : this.none();
  }

  public async run(interaction: ButtonInteraction) {
    const member = interaction.member as GuildMember;

    if (!member || !(member instanceof GuildMember)) {
      return this.replyError(
        interaction,
        'Something went wrong, please try again later.'
      );
    }

    if (!member.roles.cache.has(this.requiredRole)) {
      return this.replyError(
        interaction,
        'Only staff members can claim tickets.'
      );
    }

    await interaction.deferUpdate();

    const maria = await getMariaConnection();
    const [ticket] = await maria.query(
      'SELECT * FROM support_tickets WHERE channel_id = ?',
      [interaction.channel?.id]
    );

    if (!ticket) {
      maria.release();
      return this.replyError(interaction, 'This is not a valid ticket.');
    }

    await this.handlePreviousMessage(interaction, ticket.claimed_message_id);

    const isClaimedByUser = ticket.staff_id === member.id;
    const action = isClaimedByUser ? 'unclaim' : 'claim';

    await this.updateTicket(maria, interaction, member, action);
    const newMessage = await this.sendTicketMessage(
      interaction,
      member,
      action
    );

    if (newMessage) {
      await maria.query(
        'UPDATE support_tickets SET claimed_message_id = ? WHERE channel_id = ?',
        [newMessage.id, interaction.channel?.id]
      );
    }

    maria.release();

    await this.updateChannelName(interaction, member, ticket, action);
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

  private async handlePreviousMessage(
    interaction: ButtonInteraction,
    messageId: string | null
  ) {
    if (messageId && interaction.channel) {
      try {
        const previousMessage =
          await interaction.channel.messages.fetch(messageId);
        await previousMessage.delete();
      } catch (error) {
        console.error('Failed to delete previous message:', error);
      }
    }
  }

  private async updateTicket(
    maria: any,
    interaction: ButtonInteraction,
    member: GuildMember,
    action: 'claim' | 'unclaim',
  ) {
    const query =
      action === 'unclaim'
        ? 'UPDATE support_tickets SET staff_id = NULL, claimed_at = NULL, claimed_message_id = NULL WHERE channel_id = ?'
        : 'UPDATE support_tickets SET staff_id = ?, claimed_at = NOW(), claimed_message_id = NULL WHERE channel_id = ?';
    const params =
      action === 'unclaim'
        ? [interaction.channel?.id]
        : [member.id, interaction.channel?.id];

    await maria.query(query, params);
  }

  private async sendTicketMessage(
    interaction: ButtonInteraction,
    member: GuildMember,
    action: 'claim' | 'unclaim'
  ) {
    if (!interaction.channel?.isSendable()) return null;

    const isClaim = action === 'claim';
    return await interaction.channel.send({
      embeds: [
        createEmbed({
          theme: isClaim ? 'success' : 'failure',
          title: `${isClaim ? emojis.checkmark : emojis.nocross} Ticket ${isClaim ? 'Claimed' : 'Unclaimed'}`,
          text: `<@${member.id}> has ${isClaim ? 'claimed' : 'unclaimed'} the ticket.`,
        }),
      ],
    });
  }

  private async updateChannelName(
    interaction: ButtonInteraction,
    member: GuildMember,
    ticket: any,
    action: 'claim' | 'unclaim'
  ) {
    if (
      !interaction.channel?.isDMBased() &&
      interaction.channel?.isTextBased()
    ) {
      const channel = interaction.channel as TextChannel;
      const ticketNumber = ticket.ticket_number.toString().padStart(4, '0');
      const newName =
        action === 'unclaim'
          ? `ticket-${ticketNumber}`
          : `${member.user.username}-${ticketNumber}`;
      await channel.setName(newName);
    }
  }
}
