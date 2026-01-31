/**
 * @fileoverview channelApi.ts 文件职责说明。
 */
import { BaseAPI } from "../../../shared/net/BaseAPI";
import { getLatestLocalMessageTimeMs } from "@/shared/utils/localState";
import type { Message } from "@/features/chat/domain/types/Message";
import { addMessages } from "@/features/chat/presentation/store/messageList";
import Avatar from "/test_avatar.jpg?url";

export type ChannelSummary = {
    cid: number;
    name: string;
    owner: number;
    avatar: number;
    brief: string;
};

type ChannelMessageItem = {
    mid: number;
    domain: string;
    uid: number;
    cid: number;
    data: { text?: string };
    send_time: number;
};

// 频道基本操作服务类
export class ChannelBasicService extends BaseAPI {
    /**
     * 创建频道
     * @returns 创建的频道信息
     */
    createChannel() {
        return this.send("core/channel/create", {});
    }

    /**
     * 删除频道
     * @param cid 频道ID
     * @returns TODO.
     */
    deleteChannel(cid: number) {
        return this.send("core/channel/delete", { cid });
    }

    /**
     * 获取频道信息
     * @param cid 频道ID
     * @returns 频道信息
     */
    getChannelMessage(cid: number) {
        return this.send("core/channel/profile/get", { cid }, (data: unknown) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            return JSON.parse(raw) as Record<string, unknown>;
        });
    }

    /**
     * 更新频道信息
     * @param cid 频道ID
     * @param name 频道名称
     * @param owner 所有者
     * @param message 消息
     * @param brief 简介
     * @param avatar 头像
     */
    updateChannelMessage(cid: number, name: string, owner: number, brief: string, avatar: number) {
        this.sendRequest("core/channel/profile/update", {
            cid,
            name,
            owner,
            brief,
            avatar,
        });
    }

    /**
     * 获取所有频道
     * @returns 所有频道列表
     */
    public getAllChannels(): Promise<ChannelSummary[]> {
        return this.send("core/channel/list", {}, (data: unknown) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            const value = JSON.parse(raw) as Record<string, unknown>;
            const channels = value["channels"];
            if (Array.isArray(channels)) return channels as ChannelSummary[];
            return [];
        });
    }
}

// 频道消息服务类
export class ChannelMessageService extends BaseAPI {
    /**
     * 获取消息列表
     * @param cid 频道ID
     * @param start_time 开始时间
     * @param count 消息数量
     * @returns 消息列表
     */
    getMessages(cid: number, start_time: number, count: number) {
        return this.send("core/channel/message/list", { cid, start_time, count }, (data: unknown) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            const value = JSON.parse(raw) as Record<string, unknown>;
            const list = Array.isArray(value["messages"]) ? (value["messages"] as ChannelMessageItem[]) : [];
            const mapped: Message[] = list.map((item) => ({
                id: String(item.mid),
                from_id: item.uid,
                name: `User ${item.uid}`,
                avatar: Avatar,
                content: typeof item.data?.text === "string" ? item.data.text : JSON.stringify(item.data ?? {}),
                timestamp: new Date(item.send_time).toISOString(),
            }));
            return mapped;
        }).then((messages) => {
            addMessages(messages, this.getChannelSocket(), cid);
            return messages;
        });
    }

    /**
     * 发送消息
     * @param type 消息类型
     * @param content 消息内容
     * @param cid - TODO.
     * @returns TODO.
     */
    sendMessage(cid: number, content: string) {
        // 错误处理已在基类中完成
        return this.send("core/channel/message/create", {
            type: "Core:Text",
            cid,
            data: { text: content },
        }, (data: unknown) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            return Number(parsed["mid"] ?? 0);
        });
    }

    /**
     * 删除消息
     * @param mid 消息ID
     * @returns TODO.
     */
    deleteMessage(mid: number) {
        // 错误处理已在基类中完成
        return this.send("core/channel/message/delete", { mid });
    }

    /**
     * getUnreadCount method.
     * @param cid - TODO.
     * @param start_time - TODO.
     * @returns TODO.
     */
    getUnreadCount(cid: number, start_time: number) {
        return this.send("core/channel/message/unread/get", { cid, start_time }, (data: unknown) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            return Number(parsed["count"] ?? 0);
        });
    }

    /**
     * updateReadState method.
     * @param cid - TODO.
     * @param last_read_time - TODO.
     * @returns TODO.
     */
    updateReadState(cid: number, last_read_time: number) {
        return this.send("core/channel/message/read/state/update", { cid, last_read_time });
    }

    /**
     * getReadState method.
     * @param cid - TODO.
     * @returns TODO.
     */
    getReadState(cid: number) {
        return this.send("core/channel/message/read/state/get", { cid }, (data: unknown) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            return JSON.parse(raw) as Record<string, unknown>;
        });
    }
    /**
     * 登陆后更新全部消息
     * @returns TODO.
     */
    public async getAllUnreceivedMessages() {
        // 先获取全部频道
        const channels = await new ChannelBasicService(this.getChannelSocket()).getAllChannels();
        const localLatestMessagesDate: number = getLatestLocalMessageTimeMs();
        for (const channel of channels) {
            // 获取全部消息
            await this.getMessages(channel.cid, localLatestMessagesDate, 10000);
        }
    }
}

export default ChannelMessageService

// 频道成员服务类
export class ChannelMemberService extends BaseAPI {
    /**
     * 获取所有成员
     * @param cid 频道ID
     * @returns 成员列表
     */
    getAllMembers(cid: number) {
        return this.send("core/channel/member/list", { cid }, (data: unknown) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            return JSON.parse(raw) as { count?: number; members?: unknown[] };
        });
    }

    /**
     * 删除频道成员
     * @param cid 频道ID
     * @param uid 用户ID
     * @returns TODO.
     */
    deleteChannelMember(cid: number, uid: number) {
        // 错误处理已在基类中完成
        return this.send("core/channel/member/delete", { cid, uid });
    }
}

// 频道管理员服务类
export class ChannelAdminService extends BaseAPI {
    /**
     * 创建频道管理员
     * @param cid 频道ID
     * @param uid 用户ID
     * @returns TODO.
     */
    createChannelAdmin(cid: number, uid: number) {
        // 错误处理已在基类中完成
        return this.send("core/channel/admin/create", { cid, uid });
    }

    /**
     * 删除频道管理员
     * @param cid 频道ID
     * @param uid 用户ID
     * @returns TODO.
     */
    deleteChannelAdmin(cid: number, uid: number) {
        // 错误处理已在基类中完成
        return this.send("core/channel/admin/delete", { cid, uid });
    }
}

// 频道申请服务类
export class ChannelApplicationService extends BaseAPI {
    /**
     * 申请加入频道
     * @param cid 频道ID
     * @returns TODO.
     */
    applyChannel(cid: number) {
        // 错误处理已在基类中完成
        return this.send("core/channel/application/create", { cid, msg: "" });
    }

    /**
     * 处理频道申请
     * @param aid 申请ID
     * @param result 处理结果
     */
    processChannelApplication(aid: number, result: number) {
        this.sendRequest("core/channel/application/process", { aid, result });
    }

    /**
     * 获取所有频道申请
     * @param table 申请表
     * @param cid - TODO.
     * @param page - TODO.
     * @param page_size - TODO.
     * @returns TODO.
     */
    getAllChannelsApplication(cid: number, page: number, page_size: number) {
        // 错误处理已在基类中完成
        return this.send("core/channel/application/list", { cid, page, page_size });
    }
}

// 频道封禁服务类
export class ChannelBanService extends BaseAPI {
    /**
     * 创建成员封禁
     * @param cid 频道ID
     * @param uid 用户ID
     * @param duration 封禁时长
     * @returns TODO.
     */
    async createMemberBan(cid: number, uid: number, duration: number) {
        // 错误处理已在基类中完成
        return this.send("core/channel/ban/create", {
            cid,
            uid,
            duration,
        });
    }

    /**
     * 删除成员封禁
     * @param cid 频道ID
     * @param uid 用户ID
     * @returns TODO.
     */
    async deleteMemberBan(cid: number, uid: number) {
        // 错误处理已在基类中完成
        return this.send("core/channel/ban/delete", { cid, uid });
    }

    /**
     * 获取所有成员封禁列表
     * @param cid 频道ID
     * @returns 封禁列表
     */
    async getAllMemberBansList(cid: number) {
        return this.send("core/channel/ban/list", { cid });
    }
}

// 导出接口
export interface GetAllChannelsApplicationTable {
    aid: number,
    state: number,
    apply_time: number,
    msg: string,
    uid: number,
}
