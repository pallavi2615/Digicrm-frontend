import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { captureReferral } from "@/lib/referral";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { getSeoSettings } from "@/lib/cms.functions";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { QueryClientProvider } from "@/lib/react-data-client";
import { appQueryClient } from "@/lib/query-client";
import { RouteHeadSync } from "@/lib/route-head";

function Analytics() {
  useEffect(() => {
    captureReferral();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.top !== window.self) return;
    let cancelled = false;
    void getSeoSettings().then((seo) => {
      if (cancelled || !seo) return;
      const add = (src: string, inline?: string) => {
        const el = document.createElement("script");
        if (src) { el.src = src; el.async = true; }
        else if (inline) { el.innerHTML = inline; }
        document.head.appendChild(el);
      };
      if (seo.ga_id) {
        add(`https://www.googletagmanager.com/gtag/js?id=${seo.ga_id}`);
        add("", `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${seo.ga_id}');`);
      }
      if (seo.gtm_id) {
        add("", `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${seo.gtm_id}');`);
      }
      if (seo.meta_pixel_id) {
        add("", `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${seo.meta_pixel_id}');fbq('track','PageView');`);
      }
    }).catch((error) => reportLovableError(error, { boundary: "seo_analytics" }));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void appQueryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}

export function RootLayout() {
  return (
    <QueryClientProvider client={appQueryClient}>
      <TooltipProvider delayDuration={200}>
        <PermissionsProvider>
          <Analytics />
          <RouteHeadSync />
          <Outlet />
          <Toaster richColors position="top-right" />
        </PermissionsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
