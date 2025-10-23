import { BaseChannelAPI } from "./BaseAPI";

// 频道基本操作服务类
class ChannelBasicService extends BaseChannelAPI {
    /**
     * 创建频道
     * @returns 创建的频道信息
     */
    createChannel() {
        return this.sendRequestWithResponse("core/channel/create", undefined, (data) => {
            const value = JSON.parse(data);
            if (value["channel"] != null) {
                return value["channel"];
            } else {
                // TODO: 弹窗提示创建失败
                return null;
            }
        });
    }

    /**
     * 删除频道
     * @param cid 频道ID
     */
    deleteChannel(cid: number) {
        const result = this.sendRequestWithResponse("core/channel/delete", { cid });
        // 错误处理已在基类中完成
        return result;
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
class ChannelMessageService extends BaseChannelAPI {
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
        const response = this.sendRequestWithResponse("core/channel/message/create", {
            type,
            content
        });
        // 错误处理已在基类中完成
        return response;
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
class ChannelMemberService extends BaseChannelAPI {
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
        const response = this.sendRequestWithResponse("core/channel/member/delete", { cid, uid });
        // 错误处理已在基类中完成
        return response;
    }
}

// 频道管理员服务类
class ChannelAdminService extends BaseChannelAPI {
    /**
     * 创建频道管理员
     * @param cid 频道ID
     * @param uid 用户ID
     */
    createChannelAdmin(cid: number, uid: number) {
        const response = this.sendRequestWithResponse("core/channel/admin/create", { cid, uid });
        // 错误处理已在基类中完成
        return response;
    }

    /**
     * 删除频道管理员
     * @param cid 频道ID
     * @param uid 用户ID
     */
    deleteChannelAdmin(cid: number, uid: number) {
        const response = this.sendRequestWithResponse("core/channel/admin/delete", { cid, uid });
        // 错误处理已在基类中完成
        return response;
    }
}

// 频道申请服务类
class ChannelApplicationService extends BaseChannelAPI {
    /**
     * 申请加入频道
     * @param cid 频道ID
     */
    applyChannel(cid: number) {
        const response = this.sendRequestWithResponse("core/channel/application", { cid });
        // 错误处理已在基类中完成
        return response;
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
        const response = this.sendRequestWithResponse("core/channel/application/list", table);
        // 错误处理已在基类中完成
        return response;
    }
}

// 频道封禁服务类
class ChannelBanService extends BaseChannelAPI {
    /**
     * 创建成员封禁
     * @param cid 频道ID
     * @param uid 用户ID
     * @param duration 封禁时长
     * @param state 状态
     * @param admin_id 管理员ID
     */
    createMemberBan(cid: number, uid: number, duration: number, state: number, admin_id: number) {
        const response = this.sendRequestWithResponse("core/channel/ban/create", {
            cid,
            uid,
            duration,
            state,
            admin_id
        });
        // 错误处理已在基类中完成
        return response;
    }

    /**
     * 删除成员封禁
     * @param cid 频道ID
     * @param uid 用户ID
     */
    deleteMemberBan(cid: number, uid: number) {
        const response = this.sendRequestWithResponse("core/channel/ban/delete", { cid, uid });
        // 错误处理已在基类中完成
        return response;
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

// 创建服务实例
const channelBasicService = new ChannelBasicService();
const channelMessageService = new ChannelMessageService();
const channelMemberService = new ChannelMemberService();
const channelAdminService = new ChannelAdminService();
const channelApplicationService = new ChannelApplicationService();
const channelBanService = new ChannelBanService();

// 导出接口
export interface GetAllChannelsApplicationTable {
    aid: number,
    state: number,
    apply_time: number,
    msg: string,
    uid: number,
}

// 导出函数，保持与原有API兼容
export const createChannel = () => channelBasicService.createChannel();
export const deleteChannel = (cid: number) => channelBasicService.deleteChannel(cid);
export const getChannelMessage = (cid: number) => channelBasicService.getChannelMessage(cid);
export const updateChannelMessage = (cid: number, name: string, owner: string, message: string, brief: string, avatar: string) => 
    channelBasicService.updateChannelMessage(cid, name, owner, message, brief, avatar);
export const getAllChannels = () => channelBasicService.getAllChannels();

export const getMessages = (cid: number, start_time: number, count: number) => 
    channelMessageService.getMessages(cid, start_time, count);
export const sendMessage = (type: string, content: string) => 
    channelMessageService.sendMessage(type, content);
export const deleteMessage = (mid: number) => channelMessageService.deleteMessage(mid);

export const getAllMembers = (cid: number) => channelMemberService.getAllMembers(cid);
export const deleteChannelMember = (cid: number, uid: number) => 
    channelMemberService.deleteChannelMember(cid, uid);

export const createChannelAdmin = (cid: number, uid: number) => 
    channelAdminService.createChannelAdmin(cid, uid);
export const deleteChannelAdmin = (cid: number, uid: number) => 
    channelAdminService.deleteChannelAdmin(cid, uid);

export const applyChannel = (cid: number) => channelApplicationService.applyChannel(cid);
export const processChannelApplication = (aid: number, result: number) => 
    channelApplicationService.processChannelApplication(aid, result);
export const getAllChannelsApplication = (table: GetAllChannelsApplicationTable[]) => 
    channelApplicationService.getAllChannelsApplication(table);

export const createMemberBan = (cid: number, uid: number, duration: number, state: number, admin_id: number) => 
    channelBanService.createMemberBan(cid, uid, duration, state, admin_id);
export const deleteMemberBan = (cid: number, uid: number) => 
    channelBanService.deleteMemberBan(cid, uid);
export const getAllMemberBansList = (cid: number) => channelBanService.getAllMemberBansList(cid);

// 导出服务类，供需要直接使用的场景
export {
    ChannelBasicService,
    ChannelMessageService,
    ChannelMemberService,
    ChannelAdminService,
    ChannelApplicationService,
    ChannelBanService
};

// 导出服务实例
export {
    channelBasicService,
    channelMessageService,
    channelMemberService,
    channelAdminService,
    channelApplicationService,
    channelBanService
};