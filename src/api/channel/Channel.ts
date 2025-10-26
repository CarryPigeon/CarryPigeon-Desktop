import {BaseAPI} from "../BaseAPI";

// 频道基本操作服务类
export class ChannelBasicService extends BaseAPI {
    /**
     * 创建频道
     * @returns 创建的频道信息
     */
    createChannel() {
        return this.sendRequestWithResponse("core/channel/create", undefined, (data) => {
            const value = JSON.parse(data);
            if (value["cid"] != null) {
                return value["cid"];
            } else {
                // TODO: 弹窗提示创建失败
                return value["msg"];
            }
        });
    }

    /**
     * 删除频道
     * @param cid 频道ID
     */
    deleteChannel(cid: number) {
        return this.sendRequestWithResponse("core/channel/delete", { cid });
    }

    /**
     * 获取频道信息
     * @param cid 频道ID
     * @returns 频道信息
     */
    getChannelMessage(cid: number) {
        return this.sendRequestWithResponse("core/channel/data/get", { cid });
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
    updateChannelMessage(cid: number, name: string, owner: string, message: string, brief: string, avatar: string) {
        this.sendRequest("core/channel/data/update", {
            cid,
            name,
            owner,
            brief,
            message,
            avatar
        });
    }

    /**
     * 获取所有频道
     * @returns 所有频道列表
     */
    getAllChannels() {
        return this.sendRequestWithResponse("core/channel/list", {});
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
        return this.sendRequestWithResponse("core/channel/message/list", {
            cid,
            start_time,
            count
        });
    }

    /**
     * 发送消息
     * @param type 消息类型
     * @param content 消息内容
     */
    sendMessage(type: string, content: string) {
        // 错误处理已在基类中完成
        return this.sendRequestWithResponse("core/channel/message/create", {
            type,
            content
        });
    }

    /**
     * 删除消息
     * @param mid 消息ID
     */
    deleteMessage(mid: number) {
        const response = this.sendRequestWithResponse("core/channel/message/delete", { mid });
        // 错误处理已在基类中完成
        return response;
    }
}

// 频道成员服务类
export class ChannelMemberService extends BaseAPI {
    /**
     * 获取所有成员
     * @param cid 频道ID
     * @returns 成员列表
     */
    getAllMembers(cid: number) {
        return this.sendRequestWithResponse("core/channel/member/list", { cid });
    }

    /**
     * 删除频道成员
     * @param cid 频道ID
     * @param uid 用户ID
     */
    deleteChannelMember(cid: number, uid: number) {
        // 错误处理已在基类中完成
        return this.sendRequestWithResponse("core/channel/member/delete", {cid, uid});
    }
}

// 频道管理员服务类
export class ChannelAdminService extends BaseAPI {
    /**
     * 创建频道管理员
     * @param cid 频道ID
     * @param uid 用户ID
     */
    createChannelAdmin(cid: number, uid: number) {
        // 错误处理已在基类中完成
        return this.sendRequestWithResponse("core/channel/admin/create", {cid, uid});
    }

    /**
     * 删除频道管理员
     * @param cid 频道ID
     * @param uid 用户ID
     */
    deleteChannelAdmin(cid: number, uid: number) {
        // 错误处理已在基类中完成
        return this.sendRequestWithResponse("core/channel/admin/delete", {cid, uid});
    }
}

// 频道申请服务类
export class ChannelApplicationService extends BaseAPI {
    /**
     * 申请加入频道
     * @param cid 频道ID
     */
    applyChannel(cid: number) {
        // 错误处理已在基类中完成
        return this.sendRequestWithResponse("core/channel/application", {cid});
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
     */
    getAllChannelsApplication(table: GetAllChannelsApplicationTable[]) {
        // 错误处理已在基类中完成
        return this.sendRequestWithResponse("core/channel/application/list", table);
    }
}

// 频道封禁服务类
export class ChannelBanService extends BaseAPI {
    /**
     * 创建成员封禁
     * @param cid 频道ID
     * @param uid 用户ID
     * @param duration 封禁时长
     * @param state 状态
     * @param admin_id 管理员ID
     */
    createMemberBan(cid: number, uid: number, duration: number, state: number, admin_id: number) {
        // 错误处理已在基类中完成
        return this.sendRequestWithResponse("core/channel/ban/create", {
            cid,
            uid,
            duration,
            state,
            admin_id
        });
    }

    /**
     * 删除成员封禁
     * @param cid 频道ID
     * @param uid 用户ID
     */
    deleteMemberBan(cid: number, uid: number) {
        // 错误处理已在基类中完成
        return this.sendRequestWithResponse("core/channel/ban/delete", {cid, uid});
    }

    /**
     * 获取所有成员封禁列表
     * @param cid 频道ID
     * @returns 封禁列表
     */
    getAllMemberBansList(cid: number) {
        return this.sendRequestWithResponse("core/channel/ban/list", { cid });
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