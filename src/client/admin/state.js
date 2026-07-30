// 管理后台共享状态
export const state = {
  adminKey: localStorage.getItem("admin_key") || "",
  adminLevel: null,
  refreshInterval: null,
  expandedRoom: null,
  ptsSelectedUser: null,
  ptsCheckedUsers: new Set(),
  ipgExpanded: null,
};
