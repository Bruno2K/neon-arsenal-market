import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { RouteFocus } from "@/components/RouteFocus";
import { SiteFooter } from "@/components/SiteFooter";

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <RouteFocus />
      <Header />
      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
