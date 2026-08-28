import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ContactsPage from "../ContactsPage.vue";
import { getActiveChatServerSocket } from "@/features/chat/composition/serverWorkspaceAdapter";
import { readAuthToken } from "@/shared/utils/localState";
import { getAccountCapabilities } from "@/features/account/api";
import { ensureValidAccessToken } from "@/shared/net/auth/authSessionManager";

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

  it("shows uid-only hint instead of calling users search for nicknames", async () => {
    const wrapper = mount(ContactsPage);
    await flushPromises();
    const input = wrapper.find(".cp-contacts__search-input");
    await input.setValue("alice");
    vi.advanceTimersByTime(300);
    await flushPromises();
    expect(wrapper.text()).toContain("contacts_search_need_uid");
  });

  it("looks up a snowflake uid via getUser when refresh token is empty", async () => {
    const getUser = vi.fn().mockResolvedValue({ uid: "2092085802191425536", nickname: "alice" });
    const listUsers = vi.fn();
    vi.mocked(getActiveChatServerSocket).mockReturnValue("http://127.0.0.1:8080");
    vi.mocked(ensureValidAccessToken).mockResolvedValue("");
    vi.mocked(readAuthToken).mockReturnValue("stored-token");
    vi.mocked(getAccountCapabilities).mockReturnValue({
      forServer: () => ({
        syncCurrentUserSnapshot: vi.fn().mockResolvedValue({
          id: "2092085802191425536",
          username: "alice",
          email: "",
        }),
        getUser,
        listUsers,
      }),
    } as never);

    const wrapper = mount(ContactsPage);
    await flushPromises();
    await wrapper.find(".cp-contacts__search-input").setValue("2092085802191425536");
    vi.advanceTimersByTime(300);
    await flushPromises();

    expect(getUser).toHaveBeenCalledWith("stored-token", "2092085802191425536");
    expect(listUsers).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("alice");
    expect(wrapper.text()).toContain("2092085802191425536");
  });

  it("asks to sign in instead of showing empty results when no token is available", async () => {
    vi.mocked(getActiveChatServerSocket).mockReturnValue("http://127.0.0.1:8080");
    vi.mocked(ensureValidAccessToken).mockResolvedValue("");
    vi.mocked(readAuthToken).mockReturnValue("");

    const wrapper = mount(ContactsPage);
    await flushPromises();
    await wrapper.find(".cp-contacts__search-input").setValue("2092085802191425536");
    vi.advanceTimersByTime(300);
    await flushPromises();

    expect(wrapper.text()).toContain("contacts_search_need_signin");
    expect(wrapper.text()).not.toContain("contacts_no_results");
  });
});
