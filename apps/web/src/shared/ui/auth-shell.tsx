import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthHeading, AuthModeForm, AuthModeScene, AuthModeSwitch, AuthTitle } from "./auth-mode";
import { LogoMark } from "./logo";
import { SignInForm } from "./sign-in-form";

const sceneShape = "absolute inset-0 rounded-b-[28px] lg:rounded-[28px]";

/**
 * Sign-in and sign-up page layout. Desktop: media card on the left, form on the right.
 * Mobile: the card is a banner and the title sits over its dark lower part.
 * Fully static. The parts that follow `?mode=signup` read it on the client (auth-mode.tsx); their Suspense
 * fallbacks are the sign-in version, so the prerendered page is complete and the form is the LCP element.
 */
export async function AuthShell({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Auth" });
  return (
    <section className="mx-auto grid w-full max-w-[1600px] lg:h-[calc(100dvh-4rem)] lg:min-h-[640px] lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:p-4">
      <div className="relative h-[min(46svh,400px)] md:h-[min(48svh,460px)] lg:h-full">
        <Suspense fallback={<div className={`${sceneShape} bg-[#07070a]`} />}>
          <AuthModeScene className={sceneShape} />
        </Suspense>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden items-end justify-between gap-6 p-8 lg:flex xl:p-10">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-7" />
            <span className="font-semibold text-lg text-white tracking-tight">Plainly</span>
          </div>
          <p className="max-w-[22ch] text-right text-sm text-white/70">{t("tagline")}</p>
        </div>
      </div>

      <div className="-mt-20 md:-mt-24 relative z-10 flex justify-center px-5 pb-16 lg:mt-0 lg:items-center lg:px-10 lg:pb-0">
        <div className="w-full max-w-[400px]">
          <Suspense fallback={<AuthHeading title={t("welcomeBack")} sub={t("signinSub")} />}>
            <AuthTitle />
          </Suspense>
          <div className="mt-8">
            <Suspense fallback={<SignInForm mode="signin" next="from-url" />}>
              <AuthModeForm />
            </Suspense>
          </div>
          <Suspense fallback={<p className="mt-8 h-5" />}>
            <AuthModeSwitch />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
