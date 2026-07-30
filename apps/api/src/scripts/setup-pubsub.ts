import { PubSub, type Topic } from "@google-cloud/pubsub";

/**
 * One-time (idempotent) setup: creates the document-ingest and transcript-ingest topics and
 * their push subscriptions targeting apps/worker's /pubsub/document-ingest and
 * /pubsub/transcript-ingest endpoints. Run via `pnpm --filter @therapy-docs/api pubsub:setup`
 * against either the local emulator (PUBSUB_EMULATOR_HOST set) or real Pub/Sub. Prod equivalent
 * belongs in Terraform once this is deployed — see infra/terraform/modules/compute.
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

// Real LLM calls (embed + suggestTags/recommendDocuments) routinely take longer than Pub/Sub's
// 10-second default ack deadline — if the deadline is shorter than the handler, the SAME message
// gets redelivered while the first attempt is still in flight, causing concurrent/overlapping
// runs that each independently create rows (a status-based idempotency guard in the pipeline
// code can't catch this, since none of the concurrent runs have finished yet to flip the status).
// 600s is Pub/Sub's max and comfortably covers even a slow real model call.
const ACK_DEADLINE_SECONDS = 600;

async function ensurePushSubscription(
  topic: Topic,
  subscriptionName: string,
  pushEndpoint: string,
): Promise<void> {
  const subscription = topic.subscription(subscriptionName);
  const [exists] = await subscription.exists();
  if (!exists) {
    await topic.createSubscription(subscriptionName, {
      pushConfig: { pushEndpoint },
      ackDeadlineSeconds: ACK_DEADLINE_SECONDS,
    });
    console.log(`Created push subscription: ${subscriptionName} -> ${pushEndpoint}`);
  } else {
    await subscription.setMetadata({ ackDeadlineSeconds: ACK_DEADLINE_SECONDS });
    console.log(`Subscription already exists: ${subscriptionName} (ack deadline set to ${ACK_DEADLINE_SECONDS}s)`);
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
  const transcriptIngestTopicName = process.env.PUBSUB_TOPIC_TRANSCRIPT_INGEST ?? "transcript-ingest";

  const documentTopic = await ensureTopic(pubSub, documentIngestTopicName);
  await ensurePushSubscription(
    documentTopic,
    `${documentIngestTopicName}-worker`,
    `${workerPushUrl}/pubsub/document-ingest`,
  );

  const transcriptTopic = await ensureTopic(pubSub, transcriptIngestTopicName);
  await ensurePushSubscription(
    transcriptTopic,
    `${transcriptIngestTopicName}-worker`,
    `${workerPushUrl}/pubsub/transcript-ingest`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
