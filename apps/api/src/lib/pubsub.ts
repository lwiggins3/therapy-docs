import { PubSub } from "@google-cloud/pubsub";

/**
 * Thin publisher wrapper. The @google-cloud/pubsub client auto-detects PUBSUB_EMULATOR_HOST and
 * talks to the local emulator transparently when it's set — same code runs against real Pub/Sub
 * in production and the Docker emulator locally, no branching required.
 */
export class PubSubPublisher {
  private readonly pubSub: PubSub;

  constructor(options: { projectId: string }) {
    this.pubSub = new PubSub({ projectId: options.projectId });
  }

  async publish(topicName: string, message: Record<string, unknown>): Promise<void> {
    await this.pubSub.topic(topicName).publishMessage({ json: message });
  }
}
