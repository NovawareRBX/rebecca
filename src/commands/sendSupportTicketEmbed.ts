import { Command } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
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
          .setName('send-support-ticket-embed')
          .setDescription('Send a support ticket embed to the support channel')
          .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
      {
        idHints: ['1361704488565604486'],
      }
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    const embed = new EmbedBuilder()
      .setDescription(
        '## <:novawareemoji:1276797939074727948> Fortune Frenzy Support\n**Need help?** Click the button below to open a ticket and our team will get back to you as soon as possible.'
      )
      .setColor('#d0a955')
      .setFooter({
        text: 'Available 24/7. Please be kind to our staff.',
        iconURL:
          'https://cdn.discordapp.com/emojis/1252703372998611085.webp?size=96',
      });

    const button = new ButtonBuilder()
      .setCustomId('create-ticket')
      .setLabel('Create Ticket')
      .setEmoji("<:mail:1361707222056439947>")
      .setStyle(ButtonStyle.Secondary);

    const msgObject = {
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
    };

    if (interaction.channel?.isSendable()) {
      await interaction.channel.send(msgObject);
    } else {
      await interaction.reply({
        ...msgObject,
      });
    }
  }
}
