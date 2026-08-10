import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { StatusProvider } from "@/context/StatusContext";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import Today from "@/pages/Today";
import Archive from "@/pages/Archive";
import DispatchDetail from "@/pages/DispatchDetail";
import Mind from "@/pages/Mind";
import Sandbox from "@/pages/Sandbox";
import About from "@/pages/About";
import Transmit from "@/pages/Transmit";
import NotFound from "@/pages/NotFound";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <StatusProvider>
      <ScrollToTop />
      <a
        href="#main"
        className="focusable sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-panel focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        <main id="main" className="relative flex-1">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/dispatches" element={<Archive />} />
            <Route path="/dispatches/:id" element={<DispatchDetail />} />
            <Route path="/mind" element={<Mind />} />
            <Route path="/sandbox" element={<Sandbox />} />
            <Route path="/about" element={<About />} />
            <Route path="/transmit" element={<Transmit />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </StatusProvider>
  );
}
