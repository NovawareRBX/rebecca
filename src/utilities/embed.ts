import {
  EmbedBuilder,
  type ColorResolvable,
  type EmbedAuthorOptions,
  type EmbedFooterOptions,
  type EmbedField,
} from 'discord.js';

type EmbedTheme = 'success' | 'warning' | 'failure' | 'neutral';

interface EmbedOptions {
  text?: string;
  theme?: EmbedTheme;
  title?: string;
  author?: EmbedAuthorOptions;
  footer?: EmbedFooterOptions;
  fields?: EmbedField[];
  timestamp?: boolean | Date;
  thumbnail?: string;
  image?: string;
  url?: string;
  color?: ColorResolvable;
}

const themeColors: Record<EmbedTheme, ColorResolvable> = {
  success: '#38cc96', // Green
  warning: '#ffaa00', // Orange
  failure: '#df6461', // Red
  neutral: '#0099ff', // Blue
};

export function createEmbed(options: EmbedOptions): EmbedBuilder {
  const {
    text,
    theme = 'neutral',
    title,
    author,
    footer,
    fields,
    timestamp,
    thumbnail,
    image,
    url,
    color,
  } = options;

  const description = text
    ? title
      ? `### ${title}\n${text}`
      : text
    : title
      ? `### ${title}`
      : '';
  const embed = new EmbedBuilder()
    .setColor(color || themeColors[theme])
    .setDescription(description);

  if (author) embed.setAuthor(author);
  if (footer) embed.setFooter(footer);
  if (fields?.length) embed.addFields(fields);
  if (timestamp)
    embed.setTimestamp(timestamp === true ? new Date() : timestamp);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  if (url) embed.setURL(url);

  return embed;
}
