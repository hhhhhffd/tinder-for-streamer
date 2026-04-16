import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "react-hot-toast";
import Landing from "./pages/Landing";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Feed from "./pages/Feed";
import Matches from "./pages/Matches";
import Chat from "./pages/Chat";
import LikedMe from "./pages/LikedMe";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminReports from "./pages/admin/Reports";
import Navbar from "./components/layout/Navbar";

/** Minimal page-transition wrapper — fades content in/out */
function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Root application component.
 *
 * Sets up routing, navigation bar, page transitions, and toast notifications.
 * Landing page is a full marketing page. Authenticated routes get the Navbar.
 * Admin routes are nested under /admin with a separate layout.
 */
function App() {
  const location = useLocation();

  /** Pages where navbar is hidden and no sidebar offset is needed */
  const isFullscreenPage = location.pathname === "/" || location.pathname.startsWith("/auth");

  return (
    <div className="min-h-screen bg-background">
      {/* Global toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#18181B",
            color: "#fff",
            border: "1px solid #1F1F23",
            borderRadius: "12px",
          },
          success: {
            iconTheme: { primary: "#9146FF", secondary: "#fff" },
          },
          error: {
            iconTheme: { primary: "#EF4444", secondary: "#fff" },
          },
        }}
      />

      {/* Navigation bar — auto-hides on landing/auth/onboarding */}
      <Navbar />

      {/* Main content — offset for sidebar on desktop, except fullscreen pages */}
      <div className={isFullscreenPage ? "" : "lg:pl-56"}>
        {/* Bottom nav padding on mobile, except fullscreen pages */}
        <div className={isFullscreenPage ? "" : "pb-16 lg:pb-0"}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              {/* Landing page — full marketing page */}
              <Route path="/" element={<Landing />} />

              {/* OAuth callback */}
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Onboarding — first-time profile review */}
              <Route
                path="/onboarding"
                element={
                  <PageTransition>
                    <Onboarding />
                  </PageTransition>
                }
              />

              {/* User profile — view and edit */}
              <Route
                path="/profile"
                element={
                  <PageTransition>
                    <Profile />
                  </PageTransition>
                }
              />

              {/* Swipe feed */}
              <Route
                path="/feed"
                element={
                  <PageTransition>
                    <Feed />
                  </PageTransition>
                }
              />

              {/* Matches list */}
              <Route
                path="/matches"
                element={
                  <PageTransition>
                    <Matches />
                  </PageTransition>
                }
              />

              {/* Chat */}
              <Route
                path="/chat"
                element={
                  <PageTransition>
                    <Chat />
                  </PageTransition>
                }
              />

              {/* Who liked you (premium) */}
              <Route
                path="/liked-me"
                element={
                  <PageTransition>
                    <LikedMe />
                  </PageTransition>
                }
              />

              {/* Admin panel — nested routes with layout */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="reports" element={<AdminReports />} />
              </Route>

              {/* 404 fallback */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default App;
