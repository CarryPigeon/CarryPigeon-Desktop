import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ContactsPage from "../ContactsPage.vue";

vi.mock("vue-router", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}));

vi.mock("vue-i18n", () => ({
  useI18n: vi.fn(() => ({ t: (key: string) => key })),
}));

vi.mock("@/features/chat/composition/serverWorkspaceAdapter", () => ({
  getActiveChatServerSocket: vi.fn(() => null),
}));

vi.mock("@/shared/utils/localState", () => ({
  readAuthToken: vi.fn(() => null),
}));

vi.mock("@/features/account/api", () => ({
  getAccountCapabilities: vi.fn(() => ({ forServer: vi.fn() })),
}));

vi.mock("@/features/chat/data/chat-api/httpChatApiPort", () => ({
  httpChatApiPort: { createChannel: vi.fn() },
}));

vi.mock("@/shared/net/auth/authSessionManager", () => ({
  ensureValidAccessToken: vi.fn(() => Promise.resolve("")),
}));

vi.mock("@/shared/utils/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("@/shared/ui/PageHeader.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("@/shared/ui/ErrorBoundary.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("@/shared/ui/EmptyState.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("@/shared/ui/SkeletonBlock.vue", () => ({
  default: { template: "<div />" },
}));

describe("ContactsPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not produce an unhandled rejection on rapid input", async () => {
    const handler = vi.fn();
    // process is provided by the Vitest/Node runtime even though the test environment is jsdom.
    // @ts-expect-error process types are not included in the DOM-only tsconfig.
    process.on("unhandledRejection", handler);

    const wrapper = mount(ContactsPage);
    await flushPromises();

    const input = wrapper.find(".cp-contacts__search-input");
    await input.setValue("a");
    await input.setValue("ab");
    await flushPromises();

    vi.advanceTimersByTime(300);
    await flushPromises();

    // @ts-expect-error process types are not included in the DOM-only tsconfig.
    process.off("unhandledRejection", handler);
    expect(handler).not.toHaveBeenCalled();
  });
});
