"use client";

import { useEffect } from "react";
import { LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { ProfileExperience } from "@/components/profile/profile-experience";
import type { Profile } from "@/lib/supabase/database.types";

export function ProfileRouteModal({ profile }: { profile: Profile }) {
  const router = useRouter();

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".profile-edit-modal")) router.back();
    };

    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [router]);

  return (
    <div
      className="profile-route-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && router.back()}
    >
      <section className="profile-route-modal" role="dialog" aria-modal="true" aria-labelledby="profile-route-title">
        <header className="profile-route-header">
          <div>
            <span>PERFIL</span>
            <strong id="profile-route-title">Sua identidade no FYNEX</strong>
          </div>
          <div className="profile-route-actions">
            <form action={logoutAction}>
              <button type="submit" className="profile-logout-button" aria-label="Sair da conta" title="Sair da conta">
                <LogOut size={17} />
              </button>
            </form>
            <button type="button" onClick={() => router.back()} aria-label="Fechar perfil">
              <X size={19} />
            </button>
          </div>
        </header>
        <div className="profile-route-content">
          <ProfileExperience profile={profile} />
        </div>
      </section>
    </div>
  );
}
