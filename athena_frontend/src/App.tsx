import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { SignUpPage } from "./pages/SignUpPage";
import { DashboardLayout } from "./components/layouts/DashboardLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { WhitelistPage } from "./pages/WhitelistPage";
import { TransactionPage } from "./pages/TransactionPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage/>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* Layout route — sidebar never remounts across navigation */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/whitelist" element={<WhitelistPage />} />
          <Route path="/transaction" element={<TransactionPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
