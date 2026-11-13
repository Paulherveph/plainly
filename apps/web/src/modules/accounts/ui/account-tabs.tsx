"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import type { Profile } from "../domain/profile";
import { PrivacyPanel } from "./privacy-panel";
import { ProfileForm } from "./profile-form";
import { SecurityPanel } from "./security-panel";

/** Profile, Plan and usage, Privacy, Security (docs/AUTH.md section 4). */
export function AccountTabs(props: {
  email: string | null;
  profile: Profile;
  identities: string[];
  /** The Plan tab content (billing module), rendered on the server. */
  plan: React.ReactNode;
}) {
  const t = useTranslations("Account");
  return (
    <Tabs defaultValue="profile" className="mt-8">
      <TabsList className="flex-wrap">
        <TabsTrigger value="profile">{t("tabProfile")}</TabsTrigger>
        {props.plan ? <TabsTrigger value="plan">{t("tabPlan")}</TabsTrigger> : null}
        <TabsTrigger value="privacy">{t("tabPrivacy")}</TabsTrigger>
        <TabsTrigger value="security">{t("tabSecurity")}</TabsTrigger>
      </TabsList>
      <TabsContent value="profile" className="mt-6">
        <ProfileForm profile={props.profile} email={props.email} />
      </TabsContent>
      {props.plan ? (
        <TabsContent value="plan" className="mt-6">
          {props.plan}
        </TabsContent>
      ) : null}
      <TabsContent value="privacy" className="mt-6">
        <PrivacyPanel />
      </TabsContent>
      <TabsContent value="security" className="mt-6">
        <SecurityPanel identities={props.identities} email={props.email} />
      </TabsContent>
    </Tabs>
  );
}
