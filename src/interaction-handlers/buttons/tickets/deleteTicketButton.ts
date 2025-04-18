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
      return interaction.customId === 'delete-ticket' ? this.some() : this.none();
    }
  
    public async run(interaction: ButtonInteraction) {
      await interaction.channel?.delete();
    }
  }
  