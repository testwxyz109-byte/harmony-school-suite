export type AppRole = "admin" | "sub_admin" | "teacher";

export function isAdmin(roles: AppRole[]) {
  return roles.includes("admin");
}
export function isSubOrAdmin(roles: AppRole[]) {
  return roles.includes("admin") || roles.includes("sub_admin");
}
export function isTeacher(roles: AppRole[]) {
  return roles.includes("teacher");
}

export function canManageUsers(roles: AppRole[]) {
  return isAdmin(roles);
}
export function canManageSystemConfig(roles: AppRole[]) {
  return isAdmin(roles);
}
export function canManageFinance(roles: AppRole[]) {
  return isSubOrAdmin(roles);
}
export function canManageAcademic(roles: AppRole[]) {
  return isSubOrAdmin(roles);
}
