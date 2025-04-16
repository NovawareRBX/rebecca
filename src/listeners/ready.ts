import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { ActivityType } from 'discord.js';

@ApplyOptions<Listener.Options>({ once: true })
export class ReadyListener extends Listener {
  public run() {
    this.container.logger.info(
      `Logged in as ${this.container.client.user?.tag}`
    );

    const user = this.container.client.user;
    if (!user) return;

    user.setPresence({
      activities: [
        {
          type: ActivityType.Custom,
          name: 'custom',
          state: 'dms open for support!',
        },
      ],
    });
  }
}
