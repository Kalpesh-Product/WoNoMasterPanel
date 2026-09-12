import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./pageTour.css";
import useAuth from "../hooks/useAuth";
import useAxiosPrivate from "../hooks/useAxiosPrivate";
import { getPageTour } from "./pageTours";

const findVisible = (selector) => {
  const elements = Array.from(document.querySelectorAll(selector));
  return (
    elements.find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || null
  );
};

const normalizeElementText = (value) =>
  String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

const findStepTarget = (step) => {
  if (step.selector) {
    const selected = findVisible(step.selector);
    if (selected) return selected;
  }

  if (!step.text) return null;
  const expected = normalizeElementText(step.text);
  const candidates = Array.from(
    document.querySelectorAll(
      '[data-tour="page-content"] button, [data-tour="page-content"] a, [data-tour="page-content"] input, [data-tour="page-content"] select, [data-tour="page-content"] [role="button"], [data-tour="page-content"] h1, [data-tour="page-content"] h2, [data-tour="page-content"] h3, [data-tour="page-content"] span, [data-tour="page-content"] p',
    ),
  );

  return (
    candidates.find((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const candidateText = normalizeElementText(
        element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.getAttribute("placeholder") ||
          element.textContent,
      );
      return step.exactText ? candidateText === expected : candidateText.includes(expected);
    }) || null
  );
};

const buildSteps = (tour) => {
  const pageContent = findVisible('[data-tour="page-content"]');
  const pageHeading = findVisible(
    '[data-tour="page-content"] h1, [data-tour="page-content"] h2, [data-tour="page-content"] [role="heading"]',
  );
  const form = findVisible('[data-tour="page-content"] form');
  const records = findVisible(
    '[data-tour="page-content"] table, [data-tour="page-content"] [role="grid"], [data-tour="page-content"] .ag-root',
  );
  const guideButton = findVisible('[data-tour="page-guide-button"]');

  // Tab-aware website-editor tours expose their open editor page on the tabs
  // container (data-editor-page), so the guide only walks through the controls
  // of the visible editor tab, and skips the intro popover on non-Home tabs.
  const activeEditorPage = document
    .querySelector('[data-tour="wb-editor-page-tabs"]')
    ?.getAttribute("data-editor-page") || "";
  const isEditorTour = tour.id === "company-website-builder-editor";

  const steps = tour.skipIntro || (isEditorTour && activeEditorPage !== "home")
    ? []
    : [
        {
          element: pageHeading || pageContent || undefined,
          popover: {
            title: tour.title,
            description: tour.description,
            side: "bottom",
            align: "start",
          },
        },
      ];

  if (tour.steps?.length) {
    tour.steps
      .filter((tourStep) => !tourStep.editorPage || tourStep.editorPage === activeEditorPage)
      .forEach((tourStep) => {
      const target = findStepTarget(tourStep);
      if (!target && !tourStep.textOnly) return;
      steps.push({
        element: target ?? undefined,
        popover: {
          title: tourStep.title,
          description: tourStep.description,
          side: tourStep.side || "bottom",
          align: tourStep.align || "start",
        },
      });
    });

    if (tour.replayHint && guideButton) {
      steps.push({
        element: guideButton,
        popover: {
          title: "Replay any page guide",
          description: "Select Guide beside a page heading whenever you want to replay that page's detailed walkthrough.",
          side: "bottom",
          align: "end",
        },
      });
    }

    return steps;
  }

  if (form && tour.formDescription) {
    steps.push({
      element: form,
      popover: {
        title: "Complete this information",
        description: tour.formDescription,
        side: "top",
        align: "start",
      },
    });
  }

  if (records && tour.recordsDescription) {
    steps.push({
      element: records,
      popover: {
        title: "Work with your records",
        description: tour.recordsDescription,
        side: "top",
        align: "start",
      },
    });
  }

  if (guideButton) {
    steps.push({
      element: guideButton,
      popover: {
        title: "Need this guide again?",
        description: "Select Guide beside the page heading whenever you want to replay this page's tour.",
        side: "bottom",
        align: "end",
      },
    });
  }

  return steps;
};

export default function usePageTour() {
  const location = useLocation();
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const { auth } = useAuth();
  const driverRef = useRef(null);
  const attemptedRef = useRef("");

  const isLoggedIn = Boolean(auth?.accessToken && auth?.user);
  const userScope = String(auth?.user?._id || auth?.user?.id || auth?.user?.email || "anonymous");

  const progressQueryKey = useMemo(() => ["page-tour-progress", userScope], [userScope]);

  const currentTour = useMemo(() => getPageTour(location.pathname), [location.pathname]);

  const { data: progress = {}, isLoading: isProgressLoading } = useQuery({
    queryKey: progressQueryKey,
    queryFn: async () => {
      const response = await axios.get("/api/admin/tour-progress");
      return response?.data?.data?.progress || {};
    },
    enabled: isLoggedIn,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const saveProgress = useCallback(
    async (tourKey, version, status) => {
      const entry = {
        version,
        status,
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData(progressQueryKey, (current = {}) => ({
        ...current,
        [tourKey]: entry,
      }));

      try {
        await axios.patch(`/api/admin/tour-progress/${encodeURIComponent(tourKey)}`, {
          version,
          status,
        });
      } catch (error) {
        console.error("Unable to save page-tour progress", error);
        void queryClient.invalidateQueries({ queryKey: progressQueryKey });
      }
    },
    [axios, progressQueryKey, queryClient],
  );

  const startCurrentTour = useCallback(
    (automatic = false, allowIntroOnly = false) => {
      if (!currentTour || !isLoggedIn) return false;

      const saved = progress[currentTour.id];
      if (automatic && saved && saved.version >= currentTour.version) return false;

      const hasFunctionalTarget =
        !currentTour.steps?.length ||
        currentTour.steps.some((tourStep) => Boolean(findStepTarget(tourStep)));
      if (automatic && !allowIntroOnly && !hasFunctionalTarget) return false;

      driverRef.current?.destroy();

      const steps = buildSteps(currentTour);
      if (steps.length === 0) return false;
      let outcome = null;

      // The app scrolls inside #scrollable-content, so a step that needs the
      // nested container scrolled can be highlighted before that scroll
      // settles, drawing its box over empty space or the page footer. Keep
      // Driver re-aligned while the user scrolls or resizes during a tour.
      const refreshPosition = () => driverRef.current?.refresh();
      const scrollContainer = document.getElementById("scrollable-content");
      scrollContainer?.addEventListener("scroll", refreshPosition, { passive: true });
      window.addEventListener("resize", refreshPosition);

      const instance = driver({
        steps,
        showProgress: true,
        progressText: "{{current}} of {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Previous",
        doneBtnText: "Finish",
        popoverClass: "master-panel-page-tour",
        overlayColor: "#0f172a",
        overlayOpacity: 0.58,
        // Animated scrolling lets Driver position the next popover before the
        // nested #scrollable-content scroll settles, leaving distant steps
        // misplaced until they're revisited.
        smoothScroll: false,
        allowClose: true,
        disableActiveInteraction: true,
        // Driver's own auto-scroll skips scrolling whenever it thinks the
        // target is already inside the raw viewport bounds — it has no idea
        // the app's sticky top nav visually covers that space, so a target
        // sitting under the nav (e.g. the Guide button next to a page
        // heading) never gets scrolled into real view. Force a scroll on
        // every step instead of trusting Driver's visibility check.
        onHighlightStarted: (element) => {
          if (!element) return;
          // "center" on an element wider/taller than the viewport (e.g. a
          // full data table) scrolls past its start edge, cropping it —
          // fall back to "nearest"/"start" so the element's own edge, not
          // its middle, is what ends up on screen.
          const block = element.offsetHeight > window.innerHeight ? "start" : "center";
          const inline = element.offsetWidth > window.innerWidth ? "nearest" : "center";
          element.scrollIntoView({ behavior: "auto", block, inline });
        },
        onNextClick: (_element, _step, { driver: activeDriver }) => {
          if (activeDriver.hasNextStep()) {
            activeDriver.moveNext();
            return;
          }
          outcome = "completed";
          activeDriver.destroy();
        },
        onCloseClick: (_element, _step, { driver: activeDriver }) => {
          outcome = "skipped";
          activeDriver.destroy();
        },
        onDestroyed: () => {
          driverRef.current = null;
          scrollContainer?.removeEventListener("scroll", refreshPosition);
          window.removeEventListener("resize", refreshPosition);
          void saveProgress(currentTour.id, currentTour.version, outcome || "skipped");
        },
      });

      driverRef.current = instance;
      instance.drive();
      return true;
    },
    [currentTour, isLoggedIn, progress, saveProgress],
  );

  useEffect(() => {
    if (
      isProgressLoading ||
      !isLoggedIn ||
      !currentTour ||
      // Manual-only tours (autoStart: false) never play on page load;
      // they run only through the Guide button above.
      currentTour.autoStart === false
    )
      return;

    const attemptKey = `${userScope}:${currentTour.id}:${currentTour.version}`;
    if (attemptedRef.current === attemptKey) return;
    attemptedRef.current = attemptKey;

    const saved = progress[currentTour.id];
    if (saved && saved.version >= currentTour.version) return;

    let attempts = 0;
    let timer = 0;
    const tryStart = () => {
      attempts += 1;
      const started = startCurrentTour(true, attempts >= 10);
      if (!started && attempts < 10) {
        timer = window.setTimeout(tryStart, 500);
      }
    };
    timer = window.setTimeout(tryStart, 700);
    return () => window.clearTimeout(timer);
  }, [currentTour, isLoggedIn, isProgressLoading, progress, startCurrentTour, userScope]);

  useEffect(
    () => () => {
      driverRef.current?.destroy();
      driverRef.current = null;
    },
    [location.pathname],
  );

  return {
    isTourAvailable: Boolean(currentTour && isLoggedIn),
    startCurrentTour: () => startCurrentTour(false, true),
  };
}
