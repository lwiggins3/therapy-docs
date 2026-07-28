import { PubSub, type Topic } from "@google-cloud/pubsub";

/**
 * One-time (idempotent) setup: creates the document-ingest topic and a push subscription
 * targeting apps/worker's /pubsub/document-ingest endpoint. Run via `pnpm --filter
 * @therapy-docs/api pubsub:setup` against either the local emulator (PUBSUB_EMULATOR_HOST set)
 * or real Pub/Sub. Prod equivalent belongs in Terraform once this is deployed — see
 * infra/terraform/modules/compute.
 */
async function ensureTopic(pubSub: PubSub, topicName: string): Promise<Topic> {
  const topic = pubSub.topic(topicName);
  const [exists] = await topic.exists();
  if (!exists) {
    await pubSub.createTopic(topicName);
    console.log(`Created topic: ${topicName}`);
  } else {
    console.log(`Topic already exists: ${topicName}`);
  }
  return topic;
}

async function ensurePushSubscription(
  topic: Topic,
  subscriptionName: string,
  pushEndpoint: string,
): Promise<void> {
  const subscription = topic.subscription(subscriptionName);
  const [exists] = await subscription.exists();
  if (!exists) {
    await topic.createSubscription(subscriptionName, { pushConfig: { pushEndpoint } });
    console.log(`Created push subscription: ${subscriptionName} -> ${pushEndpoint}`);
  } else {
    console.log(`Subscription already exists: ${subscriptionName}`);
  }
}

async function main() {
  const projectId = process.env.GCP_PROJECT_ID || "therapy-docs-local";
  const workerPushUrl = process.env.WORKER_PUSH_URL;
  if (!workerPushUrl) {
    throw new Error("WORKER_PUSH_URL must be set (see .env.example)");
  }

  const pubSub = new PubSub({ projectId });
  const documentIngestTopicName = process.env.PUBSUB_TOPIC_DOCUMENT_INGEST ?? "document-ingest";

  const topic = await ensureTopic(pubSub, documentIngestTopicName);
  await ensurePushSubscription(
    topic,
    `${documentIngestTopicName}-worker`,
    `${workerPushUrl}/pubsub/document-ingest`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
