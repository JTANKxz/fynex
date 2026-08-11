"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Crown, Eye, Plus, ShieldCheck, Trash2, UserMinus, Users, X } from "lucide-react";
import { changeMemberRoleAction, createCommunityRoleAction, deleteCommunityRoleAction, removeCommunityMemberAction } from "@/app/actions/community-roles";
import type { CommunityMemberRole, CommunityRole } from "@/lib/supabase/database.types";
import type { CommunityAccess } from "@/features/community/permissions";
import type { MemberProfile } from "./member-profile-modal";
import styles from "./community-members-modal.module.css";
import { presenceLabels } from "@/lib/presence";

function memberRoleColor(member: MemberProfile) {
  if (member.isOwner) return "#f5c451";
  return member.roles?.reduce<CommunityRole | null>((highest, role) => !highest || role.position > highest.position ? role : highest, null)?.color;
}

function MemberActions({ communityId, currentUserId, member, roles, assignments, access, onChanged }: { communityId: string; currentUserId: string; member: MemberProfile; roles: CommunityRole[]; assignments: CommunityMemberRole[]; access: CommunityAccess; onChanged: () => void }) {
  const [roleState, roleAction, rolePending] = useActionState(changeMemberRoleAction, {});
  const [removeState, removeAction, removePending] = useActionState(removeCommunityMemberAction, {});
  const assignedIds = new Set(assignments.filter((item) => item.user_id === member.id).map((item) => item.role_id));
  const memberHighest = member.isOwner ? 32767 : Math.max(0, ...roles.filter((role) => assignedIds.has(role.id)).map((role) => role.position));
  const canManage = !member.isOwner && member.id !== currentUserId && access.highestPosition > memberHighest;
  const manageableRoles = roles.filter((role) => role.position < access.highestPosition);

  useEffect(() => { if (roleState.success || removeState.success) onChanged(); }, [onChanged, removeState.success, roleState.success]);

  if (!canManage || (!access.manageRoles && !access.manageMembers)) return null;
  return <div className={styles.memberActions} onClick={(event) => event.stopPropagation()}>
    {access.manageRoles && manageableRoles.length > 0 && <form action={roleAction}>
      <input type="hidden" name="communityId" value={communityId} /><input type="hidden" name="userId" value={member.id} />
      <select name="roleId" aria-label={`Cargo de ${member.display_name}`} defaultValue="">
        <option value="" disabled>Selecionar cargo</option>
        {manageableRoles.map((role) => <option key={role.id} value={role.id}>{assignedIds.has(role.id) ? `✓ ${role.name}` : role.name}</option>)}
      </select>
      <button name="operation" value="assign" disabled={rolePending} title="Adicionar cargo"><Plus size={14} /></button>
      <button name="operation" value="remove" disabled={rolePending} title="Remover cargo"><X size={14} /></button>
    </form>}
    {access.manageMembers && <form action={removeAction}><input type="hidden" name="communityId" value={communityId} /><input type="hidden" name="userId" value={member.id} /><button className={styles.danger} disabled={removePending} title="Remover da comunidade"><UserMinus size={14} /></button></form>}
    {(roleState.error || removeState.error) && <small>{roleState.error ?? removeState.error}</small>}
  </div>;
}

function RoleRow({ role, canDelete, onChanged }: { role: CommunityRole; canDelete: boolean; onChanged: () => void }) {
  const [state, action, pending] = useActionState(deleteCommunityRoleAction, {});
  useEffect(() => { if (state.success) onChanged(); }, [onChanged, state.success]);
  const permissions = role.is_admin ? ["Administrador"] : [role.manage_channels && "Canais", role.manage_roles && "Cargos", role.manage_messages && "Mensagens", role.manage_members && "Membros"].filter(Boolean);
  return <article className={styles.roleRow}>
    <i style={{ background: role.color }} /><div><strong>{role.name}<small>posição {role.position}</small></strong><span>{permissions.length ? permissions.join(" · ") : "Cargo visual"}</span></div>
    {canDelete && <form action={action}><input type="hidden" name="roleId" value={role.id} /><button disabled={pending} title="Excluir cargo"><Trash2 size={14} /></button></form>}
    {state.error && <small className={styles.rowError}>{state.error}</small>}
  </article>;
}

export function CommunityMembersModal({ communityId, communityName, currentUserId, members, roles, assignments, access, onViewProfile, onClose, onChanged }: {
  communityId: string;
  communityName: string;
  currentUserId: string;
  members: MemberProfile[];
  roles: CommunityRole[];
  assignments: CommunityMemberRole[];
  access: CommunityAccess;
  onViewProfile: (profile: MemberProfile) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"members" | "roles">("members");
  const [state, action, pending] = useActionState(createCommunityRoleAction, {});
  const orderedMembers = useMemo(() => [...members].sort((a, b) => Number(b.online) - Number(a.online) || Number(b.isOwner) - Number(a.isOwner) || a.display_name.localeCompare(b.display_name)), [members]);
  const suggestedPosition = Math.min(access.highestPosition - 1, Math.max(1, ...roles.map((role) => role.position + 1)));
  useEffect(() => { if (state.success) onChanged(); }, [onChanged, state.success]);

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-label={`Membros de ${communityName}`}>
      <header><div><span>COMUNIDADE</span><h2>{communityName}</h2><p>{members.length} {members.length === 1 ? "membro" : "membros"}</p></div><button onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>
      <nav><button className={tab === "members" ? styles.active : ""} onClick={() => setTab("members")}><Users size={15} />Membros</button><button className={tab === "roles" ? styles.active : ""} onClick={() => setTab("roles")}><ShieldCheck size={15} />Cargos</button></nav>
      <div className={styles.body}>
        {tab === "members" && <div className={styles.memberList}>{orderedMembers.map((member) => { const shownStatus = member.online ? member.presence_status ?? "online" : "invisible"; return <article key={member.id} className={styles.memberRow} onClick={() => onViewProfile(member)}>
          <div className={styles.avatar} style={{ backgroundColor: member.accent_color, backgroundImage: member.avatar_url ? `url(${member.avatar_url})` : undefined }}>{!member.avatar_url && member.display_name.slice(0, 2).toUpperCase()}<i className={styles[shownStatus] ?? styles.offline} /></div>
          <div className={styles.memberIdentity}><strong style={{ color: memberRoleColor(member) }}>{member.display_name}{member.isOwner && <Crown size={14} />}</strong><small>@{member.username} · {presenceLabels[shownStatus]}</small><div>{member.roles?.map((role) => <span key={role.id} style={{ color: role.color }}>{role.name}</span>)}</div></div>
          <button className={styles.viewButton} aria-label={`Ver perfil de ${member.display_name}`}><Eye size={15} /></button>
          <MemberActions communityId={communityId} currentUserId={currentUserId} member={member} roles={roles} assignments={assignments} access={access} onChanged={onChanged} />
        </article>; })}</div>}
        {tab === "roles" && <div className={styles.rolesLayout}>
          {access.manageRoles && <form action={action} className={styles.roleForm}><input type="hidden" name="communityId" value={communityId} /><div className={styles.formTitle}><ShieldCheck size={17} /><div><strong>Novo cargo</strong><small>O criador sempre permanece acima de todos.</small></div></div><label>Nome<input name="name" maxLength={32} required placeholder="Moderador" /></label><div className={styles.formPair}><label>Cor<input name="color" type="color" defaultValue="#8b5cf6" /></label><label>Posição<input name="position" type="number" min={1} max={Math.max(1, access.highestPosition - 1)} defaultValue={suggestedPosition} required /></label></div><fieldset><legend>Permissões</legend><label><input type="checkbox" name="isAdmin" />Administrador</label><label><input type="checkbox" name="manageChannels" />Gerenciar canais</label><label><input type="checkbox" name="manageRoles" />Gerenciar cargos</label><label><input type="checkbox" name="manageMessages" />Apagar mensagens</label><label><input type="checkbox" name="manageMembers" />Gerenciar membros</label></fieldset>{(state.error || state.success) && <p className={state.error ? styles.error : styles.success}>{state.error ?? state.success}</p>}<button disabled={pending}><Plus size={15} />{pending ? "Criando…" : "Criar cargo"}</button></form>}
          <section className={styles.roleList}><h3>CARGOS — {roles.length}</h3>{[...roles].sort((a, b) => b.position - a.position).map((role) => <RoleRow key={role.id} role={role} canDelete={access.manageRoles && role.position < access.highestPosition} onChanged={onChanged} />)}{!roles.length && <p>Nenhum cargo personalizado ainda.</p>}</section>
        </div>}
      </div>
    </section>
  </div>;
}
