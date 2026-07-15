// 插件本地房间治理能力占位实现。
// 宿主中 getRoomGovernanceCapabilities 用于拉取成员头像；
// 插件自包含，此处返回空成员列表，回退到 AvatarBadge 首字母展示。
type MemberInfo = { uid: string; avatar?: string };

type ChannelGovernance = {
  listMembers: () => Promise<MemberInfo[]>;
};

type RoomGovernanceCapabilities = {
  forChannel: (roomId: string) => ChannelGovernance;
};

export function getRoomGovernanceCapabilities(): RoomGovernanceCapabilities {
  return {
    forChannel(_roomId: string) {
      return {
        async listMembers() {
          return [];
        },
      };
    },
  };
}
