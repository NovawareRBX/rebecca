import {
  Client,
  Snowflake,
  TextChannel,
  FetchMessagesOptions,
  Message,
} from 'discord.js';
import { getMariaConnection } from '../../services/mariadb';
import { UTApi } from 'uploadthing/server';
import crypto from 'crypto';

interface StrippedMessage {
  content: string;
  author: string;
  timestamp: Date;
  attachments: { url: string; name: string | null }[];
}

async function fetchAllMessages(channel: TextChannel): Promise<Message[]> {
  const allMessages: Message[] = [];
  let lastId: string | null = null;
  const limit = 100;

  try {
    while (true) {
      const options: FetchMessagesOptions = { limit };
      if (lastId) options.before = lastId;

      const messages = await channel.messages.fetch(options);
      allMessages.push(...messages.values());

      if (messages.size < limit) break;
      const lastMessage = messages.last();
      if (!lastMessage) break;
      lastId = lastMessage.id;
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw new Error('Failed to fetch messages from channel');
  }

  return allMessages.filter(message => !message.author.bot);
}

async function uploadAttachments(
  attachments: { url: string; name: string | null }[],
  utapi: UTApi
): Promise<Map<string, string>> {
  const urlToUfsUrl = new Map<string, string>();
  const attachmentUrls = attachments.map(att => att.url);

  try {
    const uploaded = await utapi.uploadFilesFromUrl(attachmentUrls);
    for (let i = 0; i < uploaded.length; i++) {
      const originalUrl = attachmentUrls[i];
      const ufsUrl = uploaded[i].data?.ufsUrl;
      if (ufsUrl) {
        urlToUfsUrl.set(originalUrl, ufsUrl);
      }
    }
  } catch (error) {
    console.error('Error uploading attachments:', error);
  }

  return urlToUfsUrl;
}

async function saveTranscript(
  channel_id: Snowflake,
  messages: StrippedMessage[]
) {
  const transcriptId = crypto
    .randomBytes(6)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 10);

  const maria = await getMariaConnection();
  await maria.query(
    'INSERT INTO ticket_transcripts (transcript_id, messages, related_channel_id) VALUES (?, ?, ?)',
    [transcriptId, JSON.stringify(messages), channel_id]
  );

  return transcriptId;
}

export default async function (
  client: Client,
  channel_id: Snowflake
): Promise<string> {
  const channel = await client.channels.fetch(channel_id);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error('Invalid or inaccessible channel');
  }

  const messages = await fetchAllMessages(channel);
  const stripped: StrippedMessage[] = messages.map(message => ({
    content: message.content,
    author: message.author.id,
    timestamp: message.createdAt,
    attachments: message.attachments.map(attachment => ({
      url: attachment.url,
      name: attachment.name,
    })),
  }));

  const allAttachments = stripped.flatMap(message => message.attachments);
  if (allAttachments.length === 0) {
    return saveTranscript(channel_id, stripped);
  }

  const utapi = new UTApi();
  const urlToUfsUrl = await uploadAttachments(allAttachments, utapi);
  for (const message of stripped) {
    for (const attachment of message.attachments) {
      const newUrl = urlToUfsUrl.get(attachment.url);
      if (newUrl) {
        attachment.url = newUrl;
      }
    }
  }

  return saveTranscript(channel_id, stripped);
}
