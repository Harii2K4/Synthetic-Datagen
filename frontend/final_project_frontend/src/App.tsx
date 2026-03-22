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
      <Route
        path="/persona_hub"
        element={
          <HomePage
            onBackToLanding={() => navigate("/")}
            initialTabId="persona-hub"
          />
        }
      />
      <Route
        path="/view_dataset"
        element={
          <HomePage
            onBackToLanding={() => navigate("/")}
            initialTabId="view-dataset"
          />
        }
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
