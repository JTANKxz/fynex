import type { CommunityMemberRole, CommunityRole } from "@/lib/supabase/database.types";

export type CommunityPermission = "manage_channels" | "manage_roles" | "manage_messages" | "manage_members";

export type CommunityAccess = {
  isOwner: boolean;
  isAdmin: boolean;
  manageChannels: boolean;
  manageRoles: boolean;
  manageMessages: boolean;
  manageMembers: boolean;
  highestPosition: number;
};

export const EMPTY_COMMUNITY_ACCESS: CommunityAccess = {
  isOwner: false,
  isAdmin: false,
  manageChannels: false,
  manageRoles: false,
  manageMessages: false,
  manageMembers: false,
  highestPosition: 0,
};

export function resolveCommunityAccess(
  ownerId: string,
  userId: string,
  roles: CommunityRole[],
  assignments: CommunityMemberRole[],
): CommunityAccess {
  if (ownerId === userId) {
    return { isOwner: true, isAdmin: true, manageChannels: true, manageRoles: true, manageMessages: true, manageMembers: true, highestPosition: 32767 };
  }
  const roleIds = new Set(assignments.filter((item) => item.user_id === userId).map((item) => item.role_id));
  const active = roles.filter((role) => roleIds.has(role.id));
  const isAdmin = active.some((role) => role.is_admin);
  return {
    isOwner: false,
    isAdmin,
    manageChannels: isAdmin || active.some((role) => role.manage_channels),
    manageRoles: isAdmin || active.some((role) => role.manage_roles),
    manageMessages: isAdmin || active.some((role) => role.manage_messages),
    manageMembers: isAdmin || active.some((role) => role.manage_members),
    highestPosition: Math.max(0, ...active.map((role) => role.position)),
  };
}
