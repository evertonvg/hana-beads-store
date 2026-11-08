import { expect } from "@playwright/test";

import { clearInbox, readInbox } from "../../integration/mailpit";

export { clearInbox };

/**
 * The `/auth/confirm` link (path + query) of the `count`-th auth e-mail sent to `email`, once it
 * arrives. Same parsing as the integration suite (`tests/integration/mailpit.ts`).
 */
export async function latestLink(email: string, count = 1): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const inbox = await readInbox(email);
        link = inbox.at(-1)?.link;
        return inbox.length;
      },
      { message: `auth e-mail #${count} for ${email}`, timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(count);
  return link!;
}

/** How many auth e-mails `email` received so far. */
export async function inboxSize(email: string): Promise<number> {
  return (await readInbox(email)).length;
}
