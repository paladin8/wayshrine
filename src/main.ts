import { startApp } from "./app";

// Ask the browser not to evict saved games when storage runs low. Ignored where unsupported or declined.
void navigator.storage?.persist?.().catch(() => undefined);

void startApp(document.body);
