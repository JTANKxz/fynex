"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAccountAction } from "@/app/actions/account";

export function AccountDangerZone() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccountAction, {});

  return <section className="account-danger-zone">
    <div><strong>Excluir conta</strong><small>Seu perfil, mensagens, amizades e comunidades próprias serão removidos permanentemente.</small></div>
    {!open ? <button type="button" onClick={() => setOpen(true)}><Trash2 size={15} />Excluir minha conta</button> : <form action={action}>
      <label>Digite <strong>EXCLUIR</strong> para confirmar<input name="confirmation" autoComplete="off" required /></label>
      {state.error && <p className="form-message error">{state.error}</p>}
      <div><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button><button type="submit" disabled={pending}><Trash2 size={14} />{pending ? "Excluindo…" : "Excluir definitivamente"}</button></div>
    </form>}
  </section>;
}
