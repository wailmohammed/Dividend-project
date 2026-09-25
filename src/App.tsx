import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import SharedPortfolioPage from "./pages/SharedPortfolioPage";
import ProofOfWealthPage from "./pages/ProofOfWealthPage";
import ToolsIndex from "./pages/tools/ToolsIndex";
import ZakatCalculator from "./pages/tools/ZakatCalculator";
import HalalScreener from "./pages/tools/HalalScreener";
import DividendCalculator from "./pages/tools/DividendCalculator";
import ReturnsExplained from "./pages/tools/ReturnsExplained";
import DividendCalendarTool from "./pages/tools/DividendCalendarTool";
import HalalLeaderboard from "./pages/tools/HalalLeaderboard";
import DividendStockPage from "./pages/tools/DividendStockPage";
import SafetyTrackRecord from "./pages/tools/SafetyTrackRecord";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PortfolioProvider } from "./context/PortfolioContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Protected Route Component - must be rendered inside AuthProvider
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
          <div className="text-sm font-medium">Loading WealthOS...</div>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

// Main App Component with all providers properly nested
const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PortfolioProvider>
            <ThemeProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/portfolio/:shareCode" element={<SharedPortfolioPage />} />
                <Route path="/proof/:shareCode" element={<ProofOfWealthPage />} />
                <Route path="/tools" element={<ToolsIndex />} />
                <Route path="/tools/zakat-calculator" element={<ZakatCalculator />} />
                <Route path="/tools/halal-screener" element={<HalalScreener />} />
                <Route path="/tools/dividend-calculator" element={<DividendCalculator />} />
                <Route path="/tools/returns-explained" element={<ReturnsExplained />} />
                <Route path="/tools/dividend-calendar" element={<DividendCalendarTool />} />
                <Route path="/tools/leaderboard" element={<HalalLeaderboard />} />
                <Route path="/tools/safety-track-record" element={<SafetyTrackRecord />} />
                <Route path="/dividend/:ticker" element={<DividendStockPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ThemeProvider>
          </PortfolioProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
