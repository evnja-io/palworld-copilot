import { PostHog } from "posthog-node";
import { PUBLIC_POSTHOG_PROJECT_TOKEN, PUBLIC_POSTHOG_HOST } from "$env/static/public";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    if (!PUBLIC_POSTHOG_PROJECT_TOKEN) {
      throw new Error(
        "PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once PUBLIC_POSTHOG_PROJECT_TOKEN is configured"
      );
    }
    posthogClient = new PostHog(PUBLIC_POSTHOG_PROJECT_TOKEN, {
      host: PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
