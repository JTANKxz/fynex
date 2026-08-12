"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Ban, Check, Crown, Eye, MoreHorizontal, Plus, ShieldCheck, Tag, Trash2, UserMinus, Users, X } from "lucide-react";
import { banCommunityMemberAction, changeMemberRoleAction, createCommunityRoleAction, deleteCommunityRoleAction, removeCommunityMemberAction } from "@/app/actions/community-roles";
import { setOwnCommunityTagAction, setOwnDisplayRoleAction } from "@/app/actions/community-identity";
import type { CommunityMemberRole, CommunityMemberTag, CommunityRoleIcon, CommunityRoleWithIcon, CommunityTag } from "@/lib/supabase/database.types";
import type { CommunityAccess } from "@/features/community/permissions";
import { FynexColorPicker } from "@/components/ui/fynex-color-picker";
import { FynexSelect } from "@/components/ui/fynex-select";
import { RoleIcon } from "./role-icon";
import { ROLE_ICON_OPTIONS } from "@/features/community/role-icons";
import type { MemberProfile } from "./member-profile-modal";
import styles from "./community-members-modal.module.css";

function memberRoleColor(member: MemberProfile) {
  return member.roles?.find((role) => role.id === member.display_role_id)?.color ?? member.roles?.reduce<CommunityRoleWithIcon | null>((highest, role) => !highest || role.position > highest.position ? role : highest, null)?.color ?? "#c8c2b8";
}

function MemberActions({ communityId, currentUserId, member, roles, assignments, access, onChanged }: { communityId: string; currentUserId: string; member: MemberProfile; roles: CommunityRoleWithIcon[]; assignments: CommunityMemberRole[]; access: CommunityAccess; onChanged: () => void }) {
  const [roleState, roleAction, rolePending] = useActionState(changeMemberRoleAction, {});
  const [removeState, removeAction, removePending] = useActionState(removeCommunityMemberAction, {});
  const [banState, banAction, banPending] = useActionState(banCommunityMemberAction, {});
  const assignedIds = new Set(assignments.filter((item) => item.user_id === member.id).map((item) => item.role_id));
  const memberHighest = member.isOwner ? 32767 : Math.max(0, ...roles.filter((role) => assignedIds.has(role.id)).map((role) => role.position));
  const canManage = (member.isOwner && member.id === currentUserId && access.isOwner) || (!member.isOwner && member.id !== currentUserId && access.highestPosition > memberHighest);
  const manageableRoles = roles.filter((role) => role.position < access.highestPosition);

  useEffect(() => { if (roleState.success || removeState.success || banState.success) onChanged(); }, [banState.success, onChanged, removeState.success, roleState.success]);

  if (!canManage || (!access.manageRoles && !access.manageMembers)) return null;
  return <div className={styles.memberActions} onClick={(event) => event.stopPropagation()}>
    {access.manageRoles && <section className={styles.roleManager}>
      <header><ShieldCheck size={15}/><span><strong>Cargos do membro</strong><small>Clique para adicionar ou remover</small></span></header>
      <div className={styles.roleChoices}>{manageableRoles.map((role) => { const assigned = assignedIds.has(role.id); return <form action={roleAction} key={role.id}>
        <input type="hidden" name="communityId" value={communityId}/><input type="hidden" name="userId" value={member.id}/><input type="hidden" name="roleId" value={role.id}/>
        <button name="operation" value={assigned ? "remove" : "assign"} disabled={rolePending} aria-label={`${assigned ? "Remover" : "Adicionar"} cargo ${role.name}`}>
          <RoleIcon name={role.icon} customUrl={role.customIcon?.image_url} color={role.color} size={16}/><span><strong>{role.name}</strong><small>Posição {role.position}</small></span><b className={assigned ? styles.roleAssigned : ""}>{assigned ? <Check size={13}/> : <Plus size={13}/>}</b>
        </button>
      </form>; })}{!manageableRoles.length ? <p>Nenhum cargo abaixo da sua posição.</p> : null}</div>
    </section>}
    {access.manageMembers && <div className={styles.memberModeration}><form action={removeAction}><input type="hidden" name="communityId" value={communityId}/><input type="hidden" name="userId" value={member.id}/><button className={styles.danger} disabled={removePending}><UserMinus size={14}/>Remover do servidor</button></form><form action={banAction}><input type="hidden" name="communityId" value={communityId}/><input type="hidden" name="userId" value={member.id}/><button className={styles.danger} disabled={banPending}><Ban size={14}/>Banir membro</button></form></div>}
    {(roleState.error || roleState.success || removeState.error || banState.error) && <small className={roleState.error || removeState.error || banState.error ? styles.actionError : styles.actionSuccess}>{roleState.error ?? removeState.error ?? banState.error ?? roleState.success}</small>}
  </div>;
}

function MyCommunityTag({ communityId, currentUserId, tags, assignments, onChanged }: { communityId: string; currentUserId: string; tags: CommunityTag[]; assignments: CommunityMemberTag[]; onChanged: () => void }) {
  const selectedTagId = assignments.find((assignment) => assignment.user_id === currentUserId)?.tag_id ?? "";
  const [value, setValue] = useState(selectedTagId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const save = async () => {
    setBusy(true); setNotice("");
    const result = await setOwnCommunityTagAction({ communityId, tagId: value || null });
    setBusy(false); setNotice(result.error ?? result.success ?? "");
    if (!result.error) onChanged();
  };
  return <section className={styles.myTag}><Tag size={16}/><div><strong>Minha tag nesta comunidade</strong><small>Escolha a tag que aparecerá ao lado do seu perfil.</small></div><FynexSelect value={value} onChange={setValue} ariaLabel="Tag exibida no perfil" placeholder="Nenhuma tag" options={[{ value: "", label: "Nenhuma tag" }, ...tags.map((tag) => ({ value: tag.id, label: tag.name, color: tag.color, initials: "" }))]}/><button type="button" disabled={busy || value === selectedTagId} onClick={() => void save()}>{busy ? "Salvando…" : "Aplicar"}</button>{notice ? <small className={styles.tagNotice}>{notice}</small> : null}</section>;
}

function MyDisplayRole({ communityId, currentUserId, member, onChanged }: { communityId: string; currentUserId: string; member?: MemberProfile; onChanged: () => void }) {
  const [value, setValue] = useState(member?.display_role_id ?? ""); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const options = [{ value: "", label: "Maior cargo" }, ...(member?.roles ?? []).sort((a,b)=>b.position-a.position).map((role) => ({ value: role.id, label: role.name, color: role.color }))];
  if (!member?.roles?.length) return null;
  return <section className={styles.myTag}><ShieldCheck size={16}/><div><strong>Cor e ícone em destaque</strong><small>Escolha qual dos seus cargos define seu nick neste servidor.</small></div><FynexSelect value={value} onChange={setValue} ariaLabel="Cargo visual" options={options}/><button type="button" disabled={busy || value === (member.display_role_id ?? "")} onClick={() => { setBusy(true); void setOwnDisplayRoleAction({ communityId, roleId: value || null }).then((result) => { setBusy(false); setNotice(result.error ?? result.success ?? ""); if (!result.error) onChanged(); }); }}>{busy ? "Salvando…" : "Aplicar"}</button>{notice ? <small className={styles.tagNotice}>{notice}</small> : null}</section>;
}

function RoleRow({ role, canDelete, onChanged }: { role: CommunityRoleWithIcon; canDelete: boolean; onChanged: () => void }) {
  const [state, action, pending] = useActionState(deleteCommunityRoleAction, {});
  useEffect(() => { if (state.success) onChanged(); }, [onChanged, state.success]);
  const permissions = role.is_admin ? ["Administrador"] : [role.manage_channels && "Canais", role.manage_roles && "Cargos", role.manage_messages && "Mensagens", role.manage_members && "Membros"].filter(Boolean);
  return <article className={styles.roleRow}>
    <RoleIcon name={role.icon} customUrl={role.customIcon?.image_url} color={role.color} size={18} /><div><strong>{role.name}<small>posição {role.position}</small></strong><span>{permissions.length ? permissions.join(" · ") : "Cargo visual"}</span></div>
    {canDelete && <form action={action}><input type="hidden" name="roleId" value={role.id} /><button disabled={pending} title="Excluir cargo"><Trash2 size={14} /></button></form>}
    {state.error && <small className={styles.rowError}>{state.error}</small>}
  </article>;
}

export function CommunityMembersModal({ communityId, communityName, currentUserId, members, roles, roleIcons, assignments, tags, tagAssignments, access, onViewProfile, onClose, onChanged }: {
  communityId: string;
  communityName: string;
  currentUserId: string;
  members: MemberProfile[];
  roles: CommunityRoleWithIcon[];
  roleIcons: CommunityRoleIcon[];
  assignments: CommunityMemberRole[];
  tags: CommunityTag[];
  tagAssignments: CommunityMemberTag[];
  access: CommunityAccess;
  onViewProfile: (profile: MemberProfile) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"members" | "roles">("members");
  const [contextMemberId, setContextMemberId] = useState<string | null>(null);
  const [state, action, pending] = useActionState(createCommunityRoleAction, {});
  const [roleColor, setRoleColor] = useState("#6f63d9");
  const [roleIcon, setRoleIcon] = useState("shield");
  const selectedCustomIcon = roleIcon.startsWith("custom:") ? roleIcons.find((icon) => icon.id === roleIcon.slice(7)) : null;
  const effectiveRoleIcon = roleIcon.startsWith("custom:") && !selectedCustomIcon ? "shield" : roleIcon;
  const roleIconOptions = [...ROLE_ICON_OPTIONS, ...roleIcons.map((icon) => ({ value: `custom:${icon.id}`, label: icon.name, imageUrl: icon.image_url, detail: "Ícone da comunidade" }))];
  const orderedMembers = useMemo(() => [...members].sort((a, b) => Number(b.online) - Number(a.online) || Number(b.isOwner) - Number(a.isOwner) || a.display_name.localeCompare(b.display_name)), [members]);
  const suggestedPosition = Math.min(access.highestPosition - 1, Math.max(1, ...roles.map((role) => role.position + 1)));
  useEffect(() => { if (state.success) onChanged(); }, [onChanged, state.success]);

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-label={`Membros de ${communityName}`}>
      <header><div><span>COMUNIDADE</span><h2>{communityName}</h2><p>{members.length} {members.length === 1 ? "membro" : "membros"}</p></div><button onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>
      <nav><button className={tab === "members" ? styles.active : ""} onClick={() => setTab("members")}><Users size={15} />Membros</button><button className={tab === "roles" ? styles.active : ""} onClick={() => setTab("roles")}><ShieldCheck size={15} />Cargos</button></nav>
      <div className={styles.body}>
        {tab === "members" && <div className={styles.memberList}><MyCommunityTag key={`${communityId}:${tagAssignments.find((assignment) => assignment.user_id === currentUserId)?.tag_id ?? "none"}`} communityId={communityId} currentUserId={currentUserId} tags={tags} assignments={tagAssignments} onChanged={onChanged}/><MyDisplayRole communityId={communityId} currentUserId={currentUserId} member={members.find((member) => member.id === currentUserId)} onChanged={onChanged}/>{orderedMembers.map((member) => { const shownStatus = member.online ? member.presence_status ?? "online" : "invisible"; const canOpenActions = (member.id === currentUserId && member.isOwner && access.isOwner) || (!member.isOwner && member.id !== currentUserId && (access.manageRoles || access.manageMembers)); return <article key={member.id} className={styles.memberRow} onClick={() => onViewProfile(member)} onContextMenu={(event) => { if (!canOpenActions) return; event.preventDefault(); setContextMemberId((current) => current === member.id ? null : member.id); }}>
          <div className={styles.avatar} style={{ backgroundColor: member.accent_color, backgroundImage: member.avatar_url ? `url(${member.avatar_url})` : undefined }}>{!member.avatar_url && member.display_name.slice(0, 2).toUpperCase()}<i className={styles[shownStatus] ?? styles.offline} /></div>
          <div className={styles.memberIdentity}><strong style={{ color: memberRoleColor(member) }}>{member.nickname || member.display_name}{member.isOwner && <Crown size={14} />}{!member.isOwner && member.roles?.length ? <RoleIcon name={[...member.roles].sort((a, b) => b.position - a.position)[0].icon} customUrl={[...member.roles].sort((a, b) => b.position - a.position)[0].customIcon?.image_url} color={memberRoleColor(member)} size={14} /> : null}</strong><small>@{member.username}</small><div>{member.roles?.map((role) => <span key={role.id} style={{ color: role.color }}><RoleIcon name={role.icon} customUrl={role.customIcon?.image_url} color={role.color} />{role.name}</span>)}{member.tags?.map((tag) => <span className={styles.memberTag} key={tag.id} style={{ "--tag-color": tag.color } as React.CSSProperties}>#{tag.name}</span>)}</div></div>
          <button className={styles.viewButton} type="button" onClick={(event) => { event.stopPropagation(); onViewProfile(member); }} aria-label={`Ver perfil de ${member.display_name}`}><Eye size={15} /></button>
          {canOpenActions ? <button className={styles.manageButton} type="button" onClick={(event) => { event.stopPropagation(); setContextMemberId((current) => current === member.id ? null : member.id); }} aria-label={`Gerenciar ${member.display_name}`}><MoreHorizontal size={17}/></button> : null}
          {contextMemberId === member.id ? <div className={styles.contextActions} onClick={(event) => event.stopPropagation()}><small>Ações de {member.display_name}</small><MemberActions communityId={communityId} currentUserId={currentUserId} member={member} roles={roles} assignments={assignments} access={access} onChanged={() => { setContextMemberId(null); onChanged(); }} /></div> : null}
        </article>; })}</div>}
        {tab === "roles" && <div className={styles.rolesLayout}>
          {access.manageRoles && <form action={action} className={styles.roleForm}><input type="hidden" name="communityId" value={communityId} /><input type="hidden" name="icon" value={selectedCustomIcon ? "shield" : effectiveRoleIcon}/><input type="hidden" name="customIconId" value={selectedCustomIcon?.id ?? ""}/><div className={styles.formTitle}><ShieldCheck size={17} /><div><strong>Novo cargo</strong><small>O criador sempre permanece acima de todos.</small></div></div><label>Nome<input name="name" maxLength={32} required placeholder="Moderador" /></label><label>Cor<FynexColorPicker name="color" value={roleColor} onChange={setRoleColor} /></label><label className={styles.rgbRole}><input type="checkbox" name="colorMode" value="rgb"/>Cor RGB animada no nick</label><label>Ícone<div className={styles.roleIconField}><RoleIcon name={effectiveRoleIcon} customUrl={selectedCustomIcon?.image_url} color={roleColor} size={18}/><FynexSelect value={effectiveRoleIcon} onChange={setRoleIcon} ariaLabel="Ícone do cargo" options={roleIconOptions}/></div></label><label>Posição<input name="position" type="number" min={1} max={Math.max(1, access.highestPosition - 1)} defaultValue={suggestedPosition} required /></label><fieldset><legend>Permissões</legend><label><input type="checkbox" name="isAdmin" />Administrador</label><label><input type="checkbox" name="manageChannels" />Gerenciar canais</label><label><input type="checkbox" name="manageRoles" />Gerenciar cargos</label><label><input type="checkbox" name="manageMessages" />Apagar mensagens</label><label><input type="checkbox" name="manageMembers" />Gerenciar membros</label></fieldset>{(state.error || state.success) && <p className={state.error ? styles.error : styles.success}>{state.error ?? state.success}</p>}<button disabled={pending}><Plus size={15} />{pending ? "Criando…" : "Criar cargo"}</button></form>}
          <section className={styles.roleList}><h3>CARGOS — {roles.length}</h3>{[...roles].sort((a, b) => b.position - a.position).map((role) => <RoleRow key={role.id} role={role} canDelete={access.manageRoles && role.position < access.highestPosition} onChanged={onChanged} />)}{!roles.length && <p>Nenhum cargo personalizado ainda.</p>}</section>
        </div>}
      </div>
    </section>
  </div>;
}
