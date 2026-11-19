import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import TabLayout from "../../../components/Tabs/TabLayout";
import { PARTNER_TABS, partnerQueryOptions } from "./partnerTabsConfig";

const PREFETCH_GAP_MS = 250;
const IDLE_TIMEOUT_MS = 8000;

const ValueAddsPartners = () => {
  const queryClient = useQueryClient();
  const location = useLocation();

  // Warm the other partner pools once the page is idle so switching tabs is
  // instant. The visible tab is left to its own query and requests are staggered
  // so the background work never competes with the first render.
  useEffect(() => {
    const controller = new AbortController();
    let idleHandle;
    let startupTimer;

    const wait = (ms) =>
      new Promise((resolve) => {
        if (controller.signal.aborted) {
          resolve();
          return;
        }
        let timer;
        const onAbort = () => {
          clearTimeout(timer);
          resolve();
        };
        timer = setTimeout(() => {
          controller.signal.removeEventListener("abort", onAbort);
          resolve();
        }, ms);
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });

    const prefetchPools = async () => {
      const activeKey = PARTNER_TABS.find((tab) =>
        location.pathname.includes(`/value-adds-partners/${tab.key}`),
      )?.key;

      for (const tab of PARTNER_TABS) {
        if (controller.signal.aborted) return;
        if (tab.key === activeKey) continue;

        const options = partnerQueryOptions(tab.key);
        if (queryClient.getQueryData(options.queryKey)) continue;

        await queryClient.prefetchQuery(options);
        await wait(PREFETCH_GAP_MS);
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(prefetchPools, {
        timeout: IDLE_TIMEOUT_MS,
      });
    } else {
      startupTimer = setTimeout(prefetchPools, 1200);
    }

    return () => {
      controller.abort();
      if (
        idleHandle !== undefined &&
        typeof window.cancelIdleCallback === "function"
      ) {
        window.cancelIdleCallback(idleHandle);
      }
      if (startupTimer) clearTimeout(startupTimer);
    };
  }, [queryClient, location.pathname]);

  const tabs = [
    {
      label: "Visa Support",
      path: "visa-support",
      heading: "Visa Support Partners",
      description: "Review partner records for visa assistance and travel documentation support.",
    },
    {
      label: "Activation Support",
      path: "activation-support",
      heading: "Activation Support Partners",
      description: "Review partners supporting onboarding, activation, and market enablement.",
    },
    {
      label: "Company Setup",
      path: "company-setup",
      heading: "Company Setup Partners",
      description: "Review partners who assist with entity formation and company setup services.",
    },
    {
      label: "Consultation",
      path: "consultation",
      heading: "Consultation Partners",
      description: "Review advisors and consultants available for partner support workflows.",
    },
    {
      label: "Workation",
      path: "workation",
      heading: "Workation Partners",
      description: "Review partners supporting workation packages, stays, and travel experiences.",
    },
  ];

  return (
    <TabLayout
      tabs={tabs}
      basePath="/dashboard/value-adds-partners"
      defaultTabPath="visa-support"
    />
  );
};

export default ValueAddsPartners;
