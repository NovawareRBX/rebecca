import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  GuildMember,
  MessageFlags,
} from 'discord.js';
import { createEmbed } from '../../../utilities/embed';
import emojis from '../../../utilities/emojis.json' assert { type: 'json' };

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
    if (interaction.customId !== 'create-ticket') return this.none();
    return this.some();
  }

  public async run(interaction: ButtonInteraction) {
    const requiredRole = '1180093268025950338';
    const member = interaction.member as GuildMember;

    if (!member || !(member instanceof GuildMember)) {
      return await interaction.reply({
        embeds: [
          createEmbed({
            theme: 'failure',
            title: `${emojis.nocross} Error`,
            text: 'Something went wrong, please try again later.',
          }),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (!member.roles.cache.has(requiredRole)) {
      return await interaction.reply({
        embeds: [
          createEmbed({
            theme: 'failure',
            title: `${emojis.nocross} Error`,
            text: 'Tickets are not available to the public yet. Please contact a staff member if you need help.',
          }),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    await interaction.showModal(
      new ModalBuilder()
        .setCustomId('create-ticket-modal')
        .setTitle('Create Ticket')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('problem-description')
              .setLabel('What is the problem?')
              .setStyle(TextInputStyle.Paragraph)
          )
        )
    );
  }
}
