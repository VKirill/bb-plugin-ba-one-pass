// BA One Pass — frontend entry. Compiled by `bb plugin build` into dist/app.js
// + dist/app.css. React and @get-bb/plugin-sdk/app come from the BB host.
//
// Licensed under AGPL-3.0-only. Methodology adapted from AIналитик
// (https://github.com/chaussky/ainalyst), Copyright (c) 2026 Anatoly Chaussky.
import "./app.css";
import { definePluginApp, type PluginNavPanelProps } from "@get-bb/plugin-sdk/app";
import { AskInteraction } from "./src/app/AskInteraction";
import { ASK_RENDERER, PANEL_PATH, parseRoute } from "./src/app/helpers";
import { t, useLocale } from "./src/app/i18n";
import { DocumentPage } from "./src/app/pages/DocumentPage";
import { OverviewPage } from "./src/app/pages/OverviewPage";
import { ProjectsPage } from "./src/app/pages/ProjectsPage";
import { RegisterPage } from "./src/app/pages/RegisterPage";
import { SessionPage } from "./src/app/pages/SessionPage";
import { TracePage } from "./src/app/pages/TracePage";
import { Sidebar } from "./src/app/Sidebar";

/** Classic scrolling page frame used by every route except the session chat. */
function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto box-border w-full max-w-5xl px-4 pb-6 pt-3 md:px-5 md:pt-4">{children}</div>
    </div>
  );
}

function BaPanel({ subPath }: PluginNavPanelProps) {
  useLocale();
  const route = parseRoute(subPath);
  switch (route.kind) {
    case "projects":
      return (
        <PageFrame>
          <ProjectsPage />
        </PageFrame>
      );
    case "overview":
      return (
        <PageFrame>
          <OverviewPage key={route.projectId} projectId={route.projectId} />
        </PageFrame>
      );
    case "session":
      return <SessionPage key={route.threadId} projectId={route.projectId} threadId={route.threadId} />;
    case "document":
      return (
        <PageFrame>
          <DocumentPage key={`${route.projectId}/${route.documentId}`} projectId={route.projectId} documentId={route.documentId} />
        </PageFrame>
      );
    case "register":
      return (
        <PageFrame>
          <RegisterPage key={`${route.projectId}/${route.type}`} projectId={route.projectId} type={route.type} />
        </PageFrame>
      );
    case "trace":
      return (
        <PageFrame>
          <TracePage key={route.projectId} projectId={route.projectId} />
        </PageFrame>
      );
  }
}

export default definePluginApp((app) => {
  app.slots.navPanel({
    id: PANEL_PATH,
    title: t("appTitle"),
    icon: "ba-one-pass/clipboard",
    path: PANEL_PATH,
    component: BaPanel,
    experimental_sidebar: Sidebar,
  });
  app.slots.pendingInteraction({ id: ASK_RENDERER, component: AskInteraction });
});
