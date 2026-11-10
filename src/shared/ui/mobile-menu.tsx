"use client";

import { MenuIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "./button";
import { LocaleSwitch } from "./locale-switch";
import { NavLinks } from "./nav-links";

export function MobileMenu({ account }: { account: React.ReactNode }) {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? t("closeMenu") : t("openMenu")}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <XIcon /> : <MenuIcon />}
      </Button>
      <div
        id="mobile-menu"
        hidden={!open}
        className="absolute inset-x-0 top-16 animate-rise border-b bg-background px-5 pt-2 pb-5 shadow-[0_24px_40px_-24px_rgb(0_0_0/0.5)] lg:hidden"
      >
        <nav aria-label={t("main")}>
          <NavLinks variant="menu" onNavigate={() => setOpen(false)} />
        </nav>
        <div className="flex items-center justify-between gap-3 pt-4">
          <LocaleSwitch />
          {account}
        </div>
      </div>
    </>
  );
}
