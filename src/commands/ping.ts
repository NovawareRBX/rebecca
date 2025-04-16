import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';
import { createEmbed } from '../utilities/embed';
import emojis from '../utilities/emojis.json' assert { type: 'json' };

export class PingCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      builder =>
        builder
          .setName('ping')
          .setDescription('Check bot latency and API response time'),
      {
        idHints: ['1361302221651972288'],
      }
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    try {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const reply = await interaction.fetchReply();
      const roundtripLatency =
        reply.createdTimestamp - interaction.createdTimestamp;
      const apiLatency = Math.round(this.container.client.ws.ping);

      const embed = createEmbed({
        title: `${emojis.checkmark} Pong!`,
        text: 'Latency and API response time',
        theme: 'success',
        fields: [
          {
            name: 'Bot Latency',
            value: `${roundtripLatency}ms`,
            inline: true,
          },
          {
            name: 'API Latency',
            value: `${apiLatency}ms`,
            inline: true,
          },
        ],
        timestamp: true,
      });

      return interaction.editReply({
        content: null,
        embeds: [embed],
      });
    } catch (error) {
      const errorEmbed = createEmbed({
        title: `${emojis.nocross} Error`,
        text: 'Failed to retrieve latency information.',
        theme: 'failure',
      });

      if (!interaction.replied) {
        return interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }
      return interaction.editReply({
        embeds: [errorEmbed],
      });
    }
  }
}
