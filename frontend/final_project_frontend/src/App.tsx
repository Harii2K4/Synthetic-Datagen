import {
  Route,
  BrowserRouter as Router,
  Routes,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import { HomePage } from "./pages/HomePage";
import { LandingPage } from "./pages/LandingPage";

function AppContent() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path="/"
        element={<LandingPage onEnterHome={() => navigate("/home")} />}
      />
      <Route
        path="/home"
        element={<HomePage onBackToLanding={() => navigate("/")} />}
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
