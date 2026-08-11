"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
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
          <button type="button" onClick={() => router.back()} aria-label="Fechar perfil">
            <X size={19} />
          </button>
        </header>
        <div className="profile-route-content">
          <ProfileExperience profile={profile} />
        </div>
      </section>
    </div>
  );
}
